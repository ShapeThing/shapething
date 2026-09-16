# @shapething/shacl-manager

Manages a **data model**: one or more RDF graphs, of which exactly one is the *main graph*
that can be written to.

- The main graph has exactly one subject that is an `owl:Ontology`, an `sh:ShapesGraph`, or
  both. That subject is the data model.
- Every `owl:imports` on that subject names an *additional* graph. Additional graphs may be
  loaded and read (e.g. to validate against, or to let the main graph's shapes reference
  their terms), but shacl-manager never writes to them - they're someone else's standard,
  vendored or dereferenced, not this data model's own content.

See `examples/` for two worked examples of this structure.
