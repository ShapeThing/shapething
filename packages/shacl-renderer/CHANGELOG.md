# @shapething/shacl-renderer

## 2.2.0

### Minor Changes

- bacaee9: New `st:DateViewer`: shows `xsd:date`, `xsd:dateTime`, `xsd:dateTimeStamp`, `xsd:gYear` and `xsd:gYearMonth` values as the interface language writes them ("11 November 1855", "384 BC") instead of their lexical form. It is picked by score for any date value or `sh:datatype`, so generated shapes get it too. A dateTime at midnight reads as a date.
- 9c3aa61: `st:mergeAlternatives` now also works on a property shape itself: view mode shows one value composed from every branch of its `sh:alternativePath`. Every value of a branch counts, joined as a list in the content language. The new `st:mergeTemplate` places the branches in the text (`{n}`, `{n:year}`, optional `[ … ]` sections, with `|` fallbacks such as `[ ({2:year}–{3:year})| (born {2:year})]`), on its own property or on a `shui:LabelRole` one.
- bacaee9: `enableMissingShapesGeneration` now also fills a root shape (`nodeShapes`) that declares no target of its own. Such a generic shape gets a property for every predicate of the focus node that it does not cover or ignore (`sh:ignoredProperties`), so one shape can list everything about any resource, whatever its class. Shapes with a target are still filled class by class, as before.
- bacaee9: View mode lists a property's values alphabetically by the label they are shown with, as the content language sorts ("Épopée" among the E's, "Book 2" before "Book 10"), where before they were in whatever order the data gave. With `st:orderBy` they are still listed by their position, and alphabetically between values that share one or have none. Edit mode is unchanged: without `st:orderBy` its values stay in the order they were added in.

## 2.1.0

### Minor Changes

- **Notable changes in behaviour and types**

  - `Environment.focusNode` and `SubmitResult.focusNode` are widened to `NamedNode | BlankNode`. Blank focus nodes (for example an inline `sh:property [ ... ]`) are now supported, and the focus node editor is hidden for them. TypeScript code that assumes a `NamedNode` needs a type guard.
  - The first paint is now held for up to 3 s until the form settles. A new `settleTimeout` prop controls this; `0` disables it.
  - Edit mode shows validation errors straight away for existing (not new) resources.
  - `enableImageResizing` now defaults to `true`, so `shui:ImageViewer` loads remote images resized through wsrv.nl, or as Wikimedia Commons thumbnails.
  - `@comunica/query-sparql` moved from 4 to 5. Federated queries now go to the endpoint as one request instead of a `SERVICE` block.

  **Features**

  - New `ShaclRenderer` props:
    - `className` for the mode root.
    - `loadingIndicator`: a custom node, or `null` to hide the spinner.
    - `resolveLink`, to rewrite or intercept every link a viewer renders.
  - `Link`, `LinkAttributes` and `ResolveLink` are exported from the widget SDK, so links in custom viewers also go through `resolveLink`.
  - `makeReactive`, `transact` and `untracked` are exported. A reactive store passed as `dataGraph` is used live instead of being copied.
  - New `st:dirty` constraint (`st:DirtyConstraintComponent`). It checks whether the data differs from what the form opened with, for example to block submitting an unchanged form.
  - New `st:href` makes a property's values link to a path-resolved href in view mode.
  - New `st:cssClass` on property shapes and property groups.
  - New `st:imageWidth` for `ImageViewer` and `st:mapMaxZoom` for `MapViewer`.
  - New `st:collapsed` lets `st:CollapsiblePropertyGroup` start closed.
  - `viewModeLabelLayout: "columns"` aligns labels and values in two columns.
  - `enableDefaultValuesInViewMode` shows `sh:defaultValue` for missing values in view mode, for display only.
  - `enablePropertyShapeSources` adds a debug tooltip that lists the merged property shapes behind each property.
  - ErrorNavigator in edit mode: previous and next error buttons (en-GB and nl-NL).
  - `shui:DescriptionRole` is supported. `st:DescriptionRole` is deprecated but kept as an alias. `rdf:HTML` descriptions are flattened to plain text on Teaser cards.
  - `shui:IconRole` is supported in LabelViewer, AutoCompleteOption and Teaser.
  - A value can have several `shui:ClassificationRole` chips; extra ones collapse into a "+N" chip.
  - The web component gains the attributes `enablePropertyShapeSources`, `enableImageResizing` and `enableDefaultValuesInViewMode`.

  **Fixes**

  - `sh:class` and `sh:node` violations are no longer reported for federated (`SERVICE`) values that have no local triples.
  - An `rdf:langString` datatype now creates a language-tagged empty literal.
  - `jsToRdf` treats `sh:rootClass` and `sh:nodeKind sh:IRI` as resource-valued.
  - `generate()` adds `rdf:type` for target classes and respects `sh:uniqueLang`.
  - An unsupported BCP47 tag (for example `be-tarask`) no longer makes the whole environment fail.
  - Facet widgets are remounted when the type is switched, which clears stale filter text.
  - Keyboard and accessibility fixes in the FacetSearchModal, AutoCompleteEditor, EnumSelectEditor, IconifyEditor, AddressEditor and PropertyPathEditor listboxes.
  - An empty view-mode header is no longer rendered. The language-switcher header is hidden when there is nothing to switch.
  - `shacl-to-type` indents nested object types correctly.
  - Validation messages use the shape's own parameters (for example "Must be at least 20").
