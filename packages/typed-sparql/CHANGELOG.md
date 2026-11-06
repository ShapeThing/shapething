# @shapething/typed-sparql

## 0.2.0

### Minor Changes

- **Breaking (generated types)**

  - `MIN`, `MAX` and `SAMPLE` now take the type of their input instead of always `Literal`.
  - Generated `.rq.d.ts` files write datatypes in compact form (`LiteralWithDatatype<'xsd:boolean'>`) and import `LiteralWithLanguage` and `NumericLiteral`. Regenerate your type files after upgrading.

  **Features**

  - New browser-safe entry point `@shapething/typed-sparql/generate`, exporting `generateDts` and `SparqlTypesOptions`.
  - New type exports: `LiteralWithLanguage`, `NumericLiteral`, `NumericDatatype`, `ExpandDatatype` and `DatatypePrefixes`. `LiteralWithDatatype` accepts `xsd:` and `rdf:` prefixed names.
  - FILTER narrowing: `LANG(?x) = "en"`, `isNumeric`, `isIRI`/`isURI`, `isBlank`, `isLiteral` and `langMatches` narrow the binding types.
  - Precise types for projected and `BIND` expressions: built-in functions, XSD casts, `COALESCE`/`IF` unions, aggregates and typed constants.
  - Keys in the `functions` option also match by full IRI, resolved through the query's own `PREFIX` declarations.
