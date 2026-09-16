# Example: a begrippenkader (concept register) built on NL-SBB

A fictional municipality ("Gemeente Norg") manages its own thesaurus of policy concepts,
built on top of the Dutch [NL-SBB](https://docs.geostandaarden.nl/nl-sbb/nl-sbb/) standard's
SKOS application profile.

- `model.ttl` - **the data model** (writable). Its `:` subject is `owl:Ontology` +
  `sh:ShapesGraph`, and it `owl:imports` the NL-SBB profile. It adds one local rule of its
  own (every concept needs a `:beleidsdomein`) on top of the imported `skosapnl:Concept`
  shape, and ships two example concepts.
- `imports/skosapnl.ttl` - **read-only**. A vendored copy of the real NL-SBB / SKOS-AP-NL
  profile (Geonovum). shacl-manager does not edit this file - it's loaded because `model.ttl`
  imports it, and changes belong upstream.
