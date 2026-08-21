/**
 * Build catalog.json from GitHub's `dsh-plugin` topic.
 *
 * The topic is heavily squatted — thousands of repositories tag themselves
 * `dsh-plugin` for visibility without being plugins at all. The only reliable
 * signal is the package manifest: a real DSH plugin declares a `dsh` field
 * (`dsh.client` for the browser half, `dsh.bundle` for the host half). So the
 * search result is treated as a candidate list, and every candidate is
 * confirmed by reading its package.json before it reaches the catalog.
 *
 * Manifests are read from raw.githubusercontent.com, which does not draw on the
 * API rate limit; only the searches do.
 */

const TOPIC = 'dsh-plugin'
const PER_PAGE = 100
const PAGES_PER_SORT = 3
const SORTS = ['stars', 'updated']
const CONCURRENCY = 12
const SCHEMA_VERSION = 1

const token = process.env.GITHUB_TOKEN ?? ''

const apiHeaders = {
  accept: 'application/vnd.github+json',
  'user-agent': 'dsh-plugin-registry',
  'x-github-api-version': '2022-11-28',
  ...(token ? { authorization: `Bearer ${token}` } : {}),
}

/** One search page. Returns [] on failure so a partial run still produces a catalog. */
async function searchPage(sort, page) {
  const url = new URL('https://api.github.com/search/repositories')
  url.searchParams.set('q', `topic:${TOPIC}`)
  url.searchParams.set('sort', sort)
  url.searchParams.set('order', 'desc')
  url.searchParams.set('per_page', String(PER_PAGE))
  url.searchParams.set('page', String(page))
  const res = await fetch(url, { headers: apiHeaders })
  if (!res.ok) {
    console.warn(`search ${sort} p${page}: HTTP ${res.status}`)
    return []
  }
  const body = await res.json()
  return Array.isArray(body.items) ? body.items : []
}

/** Union of every search page, keyed by full_name. */
async function collectCandidates() {
  const byName = new Map()
  for (const sort of SORTS) {
    for (let page = 1; page <= PAGES_PER_SORT; page++) {
      const items = await searchPage(sort, page)
      for (const item of items) byName.set(item.full_name, item)
      if (items.length < PER_PAGE) break
    }
  }
  return [...byName.values()]
}

/** Read one repo's package.json. Tries the recorded default branch, then the usual names. */
async function readManifest(repo, defaultBranch) {
  const refs = [defaultBranch, 'main', 'master'].filter((r, i, a) => r && a.indexOf(r) === i)
  for (const ref of refs) {
    const res = await fetch(`https://raw.githubusercontent.com/${repo}/${ref}/package.json`)
    if (!res.ok) continue
    try {
      return { ref, manifest: JSON.parse(await res.text()) }
    } catch {
      // A repo whose package.json is not valid JSON is not installable.
      return undefined
    }
  }
  return undefined
}

/**
 * Project a confirmed plugin into a catalog entry, or undefined when the
 * manifest shows it is not a DSH plugin.
 */
function toEntry(item, ref, manifest) {
  const dsh = manifest?.dsh
  if (dsh === undefined || dsh === null || typeof dsh !== 'object') return undefined

  const client = typeof dsh.client === 'object' && dsh.client !== null ? dsh.client : undefined
  const entry = manifest.exports?.['./client']
  // A browser half needs both halves of its contract: the dsh.client block and
  // the exports subpath the module system fetches.
  const clientView = client && typeof entry === 'string'
    ? {
      platform: typeof client.platform === 'string' ? client.platform : 'web',
      immediately: client.immediately === true,
      inject: Array.isArray(client.inject) ? client.inject.filter(i => typeof i === 'string') : [],
      entry,
    }
    : undefined

  const hostEntry = manifest.exports?.['.'] ?? manifest.main
  // `dsh.bundle` is the declared host-half contract. A bare `main` proves
  // nothing — every npm package has one — so the bundle block is what decides.
  const hostView = typeof dsh.bundle === 'object' && dsh.bundle !== null
    ? { entry: typeof hostEntry === 'string' ? hostEntry : null, patch: dsh.bundle.patch ?? null }
    : undefined

  // Repositories carrying a `dsh` field for something other than a plugin
  // (presets, skills, agent teams) have neither half and are not installable.
  if (clientView === undefined && hostView === undefined) return undefined

  return {
    id: typeof manifest.name === 'string' && manifest.name ? manifest.name : item.name,
    repo: item.full_name,
    ref,
    version: typeof manifest.version === 'string' ? manifest.version : '0.0.0',
    description: (manifest.description ?? item.description ?? '').slice(0, 300),
    stars: item.stargazers_count ?? 0,
    updatedAt: item.pushed_at ?? null,
    license: item.license?.spdx_id ?? null,
    homepage: manifest.homepage ?? item.homepage ?? null,
    topics: Array.isArray(item.topics) ? item.topics : [],
    client: clientView ?? null,
    host: hostView ?? null,
    tarball: `https://codeload.github.com/${item.full_name}/tar.gz/${ref}`,
  }
}

/** Run `worker` over `items` with a fixed number of workers. */
async function mapPool(items, worker) {
  const out = []
  let cursor = 0
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++]
      try {
        const result = await worker(item)
        if (result !== undefined) out.push(result)
      } catch (error) {
        console.warn(`skip ${item.full_name}: ${String(error)}`)
      }
    }
  }))
  return out
}

const candidates = await collectCandidates()
console.log(`candidates: ${candidates.length}`)

const plugins = await mapPool(candidates, async (item) => {
  const read = await readManifest(item.full_name, item.default_branch)
  if (read === undefined) return undefined
  return toEntry(item, read.ref, read.manifest)
})

// Stable order so a run with no upstream change produces no diff.
plugins.sort((a, b) => (b.stars - a.stars) || a.id.localeCompare(b.id))

const catalog = {
  schemaVersion: SCHEMA_VERSION,
  generatedAt: new Date().toISOString(),
  source: { topic: TOPIC, scanned: candidates.length, accepted: plugins.length },
  plugins,
}

const { writeFile } = await import('node:fs/promises')
await writeFile('catalog.json', `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
console.log(`accepted: ${plugins.length} -> catalog.json`)
