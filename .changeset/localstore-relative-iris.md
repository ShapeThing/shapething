---
"@shapething/localstore": minor
---

Files are written with IRIs relative to their graph where they can be (`<>` for the graph itself, `<#name>`, `<other>`, `<../other>`), now also under the default `file:` base IRI, which the Turtle writer did not relativize. A file keeps its meaning when the folder gets another base IRI. IRIs of `.ttl` files stay absolute, as a relative one is read as that file's graph.
