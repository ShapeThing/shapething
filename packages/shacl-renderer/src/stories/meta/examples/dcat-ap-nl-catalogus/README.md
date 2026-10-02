# Example: an open data catalogue built on DCAT-AP-NL

The same fictional municipality ("Gemeente Norg") manages its open data catalogue's data
model on top of the Dutch [DCAT-AP-NL](https://docs.geostandaarden.nl/dcat/dcat-ap-nl30/)
profile, which itself builds on the EU DCAT-AP baseline.

- `model.ttl` - **the data model** (writable). Its `:` subject is `owl:Ontology` +
  `sh:ShapesGraph`, and it `owl:imports` both additional graphs below. It adds one local rule
  of its own (every catalog needs an `:interneVerwijzing` case reference) on top of the
  imported `dcatapnl-sh:CatalogShape`, and ships an example catalog/dataset/distribution.
- `imports/dcat-ap-nl-SHACL.ttl` - **read-only**. A vendored copy of the real DCAT-AP-NL 3.0
  SHACL shapes (Geonovum).
- `imports/dcat-ap-eu-SHACL.ttl` - **read-only**. A vendored copy of the real DCAT-AP 3.0.0
  SHACL shapes (SEMICeu) that DCAT-AP-NL builds on.

Neither file under `imports/` is edited by shacl-manager - they're loaded because `model.ttl`
imports them, and changes belong upstream.
