---
"@shapething/shacl-renderer": minor
---

A new resource in edit mode gets the `rdf:type` of its node shape's class target (its one `sh:targetClass`, or the shape itself when it is also a class), so it is found through that shape again once saved. That type is read-only in the form. `select()` takes any RDF/JS source, such as a `TextStore` or `LocalStore`, not only an `RdfStore`.
