---
"@shapething/shacl-renderer": minor
---

`enableMissingShapesGeneration` now also fills a root shape (`nodeShapes`) that declares no target of its own. Such a generic shape gets a property for every predicate of the focus node that it does not cover or ignore (`sh:ignoredProperties`), so one shape can list everything about any resource, whatever its class. Shapes with a target are still filled class by class, as before.
