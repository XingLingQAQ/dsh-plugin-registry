# dsh-plugin-registry

A machine-readable catalog of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
plugins, refreshed daily by GitHub Actions.

Clients fetch one static file — no API token, no rate limit:

```
https://raw.githubusercontent.com/XingLingQAQ/dsh-plugin-registry/main/catalog.json
```

`schema.json` defines the format; `schemaVersion` is bumped on any breaking change.

## Why this exists

The `dsh-plugin` GitHub topic is heavily squatted. A search returns thousands of
repositories, most of which tag themselves for visibility and are not plugins at
all — resume builders, low-code platforms, RAG servers. Sorting by stars makes
this worse, not better.

The only reliable signal is the package manifest. A real DSH plugin declares a
`dsh` field: `dsh.client` plus an `exports["./client"]` subpath for the browser
half, `dsh.bundle` for the host half. So the search is treated as a *candidate*
list and every candidate is confirmed by reading its `package.json` before it
reaches the catalog.

Doing that here rather than in each client matters: the confirmation costs a few
hundred requests per refresh, which no end-user application should spend, and the
result is identical for everyone.

## How a refresh works

1. Search `topic:dsh-plugin` across two sort orders (stars, recently pushed) so
   both established and active plugins are covered, then de-duplicate.
2. Read each candidate's `package.json` from `raw.githubusercontent.com`, which
   does not draw on the API rate limit.
3. Keep the ones declaring a browser half, a host half, or both. Drop the rest —
   repositories carrying a `dsh` field for presets or skills are not installable
   as plugins.
4. Look up each confirmed plugin on npm and record its published tarball.
5. Sort by stars, then id, so an unchanged upstream produces no diff. Commit only
   when the file actually changed.

## Install from `npm.tarball`, not from `tarball`

This is the part that bites. Most of these plugins declare a client entry that is
a *build output* — `./lib/client.js`, `./dist/client.js` — listed in `files` and
shipped to npm, but gitignored in the repository. A GitHub source archive
therefore lands a package whose declared entry does not exist, and the plugin
silently fails to load.

`npm.tarball` contains exactly the `files` set, already built, so installing it
needs no toolchain on the target machine. Use it. `tarball` is kept for reference
and for the rare plugin that commits its built entry.

`installable` is `false` when a plugin was never published to npm. Those entries
are reported but cannot be installed without cloning and building by hand.

## Fields worth knowing

- `client` is `null` when a plugin has no UI. Only entries with a `client` block
  contribute anything to a browser surface.
- `host` is `null` when a plugin has no host half.
- `client.entry` is the path the module system fetches, taken verbatim from
  `exports["./client"]`.
- `id` is the package name, including any scope, and is also the directory name a
  client should install into.
- `category` is a content bucket (`safety`, `manager`, `integration`, ...),
  derived deterministically from the manifest's keywords, topics, and
  description by `scripts/classify.mjs` — not a hand label. The full enum and
  the matching rules live there.

Entries are reported as found. Presence in this catalog confirms that a
repository declares itself a DSH plugin; it is not a review, an endorsement, or a
security audit. Treat plugin code as you would any third-party dependency.

## Running it locally

```sh
GITHUB_TOKEN=$(gh auth token) node scripts/build-catalog.mjs
```

Without a token the searches fall back to the unauthenticated limit (10
requests/minute), which is enough for one run.

## Adding your plugin

Nothing to submit. Tag your repository with the `dsh-plugin` topic and make sure
`package.json` declares the halves your plugin provides — the next refresh picks
it up.
