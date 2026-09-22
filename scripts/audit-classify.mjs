/**
 * Grade the classifier against the catalog it produced.
 *
 * Two questions, both worth being able to answer without guessing:
 *
 *  1. Is the catalog reproducible? `classify.mjs` is a pure function of the
 *     manifest, but the catalog stores only a subset of that manifest — so a
 *     re-run can disagree with what is on disk without anything being wrong.
 *     This reports that gap rather than hiding it, because a category nobody can
 *     re-derive is a category nobody can review.
 *  2. What is still unplaceable, and do the ones that were placed make sense?
 *     The `other` bucket is printed in full: it is the classifier's own admission
 *     of ignorance, and it is where a missing term shows up first.
 *
 * Usage: node scripts/audit-classify.mjs [category]
 */
import { readFileSync } from 'node:fs'
import { CATEGORY_IDS, explainCategory } from './classify.mjs'

const catalog = JSON.parse(readFileSync(new URL('../catalog.json', import.meta.url), 'utf8'))

/** Fields the catalog keeps, as the classifier's input shape. */
function inputOf(p) {
  return {
    id: p.id,
    description: p.description ?? '',
    topics: p.topics ?? [],
    keywords: p.keywords ?? [],
    hasClient: p.client !== null && p.client !== undefined,
    hasHost: p.host !== null && p.host !== undefined,
  }
}

const rows = catalog.plugins.map(p => ({ p, ...explainCategory(inputOf(p)) }))

const drifted = rows.filter(r => r.category !== r.p.category)
console.log(`entries: ${rows.length}`)
console.log(`re-derived differently: ${drifted.length} (expected — the catalog stores no keywords,`)
console.log('  so this audit sees less than the crawler did; treat it as a lower bound)')

const counts = new Map(CATEGORY_IDS.map(c => [c, 0]))
for (const r of rows) counts.set(r.category, (counts.get(r.category) ?? 0) + 1)

console.log('\ncategory            count')
for (const c of CATEGORY_IDS) {
  console.log(`  ${c.padEnd(18)} ${String(counts.get(c) ?? 0).padStart(4)}`)
}
const placed = rows.length - (counts.get('other') ?? 0)
console.log(`\nplaced: ${placed}/${rows.length} (${((placed / rows.length) * 100).toFixed(0)}%)`)

const cjk = rows.filter(r => /[一-鿿]/.test(r.p.description ?? ''))
const cjkOther = cjk.filter(r => r.category === 'other').length
const enOther = rows.filter(r => !/[一-鿿]/.test(r.p.description ?? '') && r.category === 'other').length
console.log(`\nChinese-described: ${cjk.length}, of which unplaced ${cjkOther}`)
console.log(`English-described: ${rows.length - cjk.length}, of which unplaced ${enOther}`)

const only = process.argv[2]
for (const c of CATEGORY_IDS) {
  if (only !== undefined && c !== only) continue
  const group = rows.filter(r => r.category === c)
  console.log(`\n=== ${c} (${group.length}) ===`)
  for (const r of group) {
    console.log(`  ${r.p.id.slice(0, 32).padEnd(34)} ${String(r.term ?? '—').padEnd(14)} ${(r.p.description ?? '').slice(0, 44)}`)
  }
}
