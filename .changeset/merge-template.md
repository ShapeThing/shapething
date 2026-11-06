---
"@shapething/shacl-renderer": minor
---

`st:mergeAlternatives` now also works on a property shape itself: view mode shows one value composed from every branch of its `sh:alternativePath`. Every value of a branch counts, joined as a list in the content language. The new `st:mergeTemplate` places the branches in the text (`{n}`, `{n:year}`, optional `[ … ]` sections), on its own property or on a `shui:LabelRole` one.
