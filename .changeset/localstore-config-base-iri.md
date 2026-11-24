---
"@shapething/localstore": minor
---

A folder can set its own base IRI in a `.config` file (JSON, `{ "baseIri": "…" }`) at its root, which overrides the base IRI given to the store. Adds `getBaseUri()`, `getConfiguredBaseUri()`, `saveBaseUri()` to write it to `.config`, and `loadConfig()` to read it again once permission to the folder is given.
