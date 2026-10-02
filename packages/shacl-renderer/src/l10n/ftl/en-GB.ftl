node-ui-property-element = Property UI Element
node-ui-submit-create = Create
node-ui-submit-update = Update
facet-mode-apply = Apply filters
title-edit = Edit { $label }
title-create = Create { $label }
title-view = { $label }
title-search = Search { $label }
title-search-all = Search
facet-type-selector-label = Type
loading = Loading
property-add-value =
    .aria-label = Add value
property-remove-value =
    .aria-label = Remove value
details-editor-options =
    .aria-label = Field options
select-an-option = - Select an option -
create-new-reference-option = Create new…
create-new-reference-option-class = Create new { $class }…
create-new-reference-title = New item
create-new-reference-done = Done
widget-switcher-label = Pick a widget
widget-switcher-tooltip = Choose which editor is used for this field. Different widgets can offer different ways to enter the same value.
logical-constraint-switcher-label = Pick an alternative
logical-constraint-switcher-tooltip = This field accepts several kinds of values. Pick which one you want to enter, then fill in the fields that appear below.
alternative-path-switcher-label = Pick where to store this
alternative-path-switcher-tooltip = This field can store its value under more than one property. Pick which one you want to use - the value itself doesn't change, only where it's stored.
drawer-property-group-add-label = Add a property
content-language-switcher-label = Content language
content-language-switcher-tooltip = Content language controls which translation of a value (for example a name or description) is shown and edited. It doesn't change the labels and buttons around it.
interface-language-switcher-label = Interface language
interface-language-switcher-tooltip = Interface language controls the language of labels, buttons and other on-screen text. It doesn't change the translated values you're editing.
content-language-create-option = Add language…
content-language-create-title = Add content language
content-language-create-label = Language tag
content-language-create-hint = Enter a BCP 47 language tag, for example en-GB or fr-FR.
content-language-create-preview = Preview: { $label }
content-language-create-error-invalid = That doesn't look like a valid BCP 47 language tag.
content-language-create-error-duplicate = That language is already in the list.
content-language-create-cancel = Cancel
content-language-create-submit = Add
content-language-delete-option =
    .aria-label = Delete { $language } content
content-language-delete-title = Delete language content
content-language-delete-message = Delete every value in { $language }? This removes them from the data entirely and cannot be undone.
content-language-delete-cancel = Cancel
content-language-delete-confirm = Delete
modal-close =
    .aria-label = Close
form-element-help =
    .aria-label = Help
form-element-required =
    .aria-label = Required
form-element-required-tooltip = This field is required
autocomplete-search-placeholder =
    .placeholder = Search…
autocomplete-no-results = No results found
autocomplete-search-error = Search failed
autocomplete-facet-search-title = Select a value for { $label }
address-search-placeholder =
    .placeholder = Search for an address…
editor-js-placeholder = Add some content…
autocomplete-edit-value =
    .aria-label = Edit
autocomplete-option-edit-resource =
    .aria-label = Edit { $label }
autocomplete-option-edit-resource-title = Edit <label>{ $label }</label>
autocomplete-option-discard-title = Discard changes?
autocomplete-option-discard-message = Discard your changes to { $label }? This cannot be undone.
autocomplete-option-discard-cancel = Keep editing
autocomplete-option-discard-confirm = Discard
blank-node-editor-assign-identifier = Change nested node to node with identifier
blank-node-editor-identifier-placeholder =
    .placeholder = Identifier (IRI)…
member-shape-list-add-item =
    .aria-label = Add item
member-shape-list-remove-item =
    .aria-label = Remove item
member-shape-list-reorder-item =
    .aria-label = Reorder item
property-federated-search-label =
    .aria-label = Federated search
property-federated-search-tooltip = This field searches an external data source
validation-severity-violation = Error:
validation-severity-warning = Warning:
validation-severity-info = Info:
report-count-violation = { $count ->
    [one] 1 error
   *[other] { $count } errors
}
report-count-warning = { $count ->
    [one] 1 warning
   *[other] { $count } warnings
}
report-count-info = { $count ->
    [one] 1 notice
   *[other] { $count } notices
}
report-count-other = { $count ->
    [one] 1 other remark
   *[other] { $count } other remarks
}
report-conforms = No problems found
report-does-not-conform = Does not conform
report-unnamed-resource = Unnamed resource
report-no-value = No value has been given
report-constraint-class = { $known ->
    [yes] Must be a { $value }
   *[no] Is not of the expected type
}
report-constraint-datatype = { $known ->
    [yes] Must be of type { $value }
   *[no] Has the wrong type of value
}
report-constraint-node-kind = { $known ->
    [yes] Must be a { $value }
   *[no] Is the wrong kind of value
}
report-constraint-min-count = { $known ->
    [yes] { $value ->
        [one] Is required
       *[other] Must have at least { $value } values
    }
   *[no] Has too few values
}
report-constraint-max-count = { $known ->
    [yes] { $value ->
        [0] Must not have a value
        [one] Must have only one value
       *[other] Must have at most { $value } values
    }
   *[no] Has too many values
}
report-constraint-min-exclusive = { $known ->
    [yes] Must be greater than { $value }
   *[no] Is too small
}
report-constraint-min-inclusive = { $known ->
    [yes] Must be at least { $value }
   *[no] Is too small
}
report-constraint-max-exclusive = { $known ->
    [yes] Must be less than { $value }
   *[no] Is too large
}
report-constraint-max-inclusive = { $known ->
    [yes] Must be at most { $value }
   *[no] Is too large
}
report-constraint-min-length = { $known ->
    [yes] Must be at least { $value } characters long
   *[no] Is too short
}
report-constraint-max-length = { $known ->
    [yes] Must be at most { $value } characters long
   *[no] Is too long
}
report-constraint-pattern = { $known ->
    [yes] Does not match the pattern { $value }
   *[no] Does not have the expected format
}
report-constraint-language-in = { $known ->
    [yes] Must be in { $value }
   *[no] Is in a language that is not allowed
}
report-constraint-unique-lang = Has more than one value in the same language
report-constraint-equals = { $known ->
    [yes] Must have the same values as { $value }
   *[no] Does not match a related property
}
report-constraint-disjoint = { $known ->
    [yes] Must not share a value with { $value }
   *[no] Shares a value with a related property
}
report-constraint-less-than = { $known ->
    [yes] Must be less than { $value }
   *[no] Is not less than a related property
}
report-constraint-less-than-or-equals = { $known ->
    [yes] Must not be greater than { $value }
   *[no] Is greater than a related property
}
report-constraint-not = { $known ->
    [yes] Must not be a { $value }
   *[no] Matches something it must not
}
report-constraint-and = Does not meet all of the required conditions
report-constraint-or = Does not meet any of the allowed alternatives
report-constraint-xone = Must meet exactly one of the alternatives
report-constraint-node = { $known ->
    [yes] Is not a valid { $value }
   *[no] Does not have the expected structure
}
report-constraint-qualified-min-count = { $known ->
    [yes] Must have at least { $value } values of the required kind
   *[no] Has too few values of the required kind
}
report-constraint-qualified-max-count = { $known ->
    [yes] Must have at most { $value } values of the required kind
   *[no] Has too many values of the required kind
}
report-constraint-closed = Is not allowed here
report-constraint-has-value = { $known ->
    [yes] Must include { $value }
   *[no] Is missing a required value
}
report-constraint-in = { $known ->
    [yes] Must be { $value }
   *[no] Is not one of the allowed values
}
report-constraint-sparql = Does not meet a custom rule
report-constraint-other = Does not meet a requirement ({ $constraint })
fileupload-description = Drag some files here or click to select files
fileupload-missing-upload-url = Missing st:uploadUrl on the property shape
fileupload-error = Upload failed
duration-editor-days = Days
duration-editor-hours = Hours
duration-editor-minutes = Minutes
duration-editor-seconds = Seconds
duration-editor-milliseconds = Milliseconds
duration-viewer-years = Years
duration-viewer-months = Months
duration-viewer-days = Days
duration-viewer-hours = Hours
duration-viewer-minutes = Minutes
duration-viewer-seconds = Seconds
duration-viewer-milliseconds = Milliseconds
color-bucket-red = Red
color-bucket-orange = Orange
color-bucket-yellow = Yellow
color-bucket-green = Green
color-bucket-cyan = Cyan
color-bucket-blue = Blue
color-bucket-purple = Purple
color-bucket-pink = Pink
color-bucket-white = White
color-bucket-gray = Gray
color-bucket-black = Black
blank-node-editor-switch-to-iri = Switch to IRI
property-path-editor-sequence-tooltip = Sequence path — follows each step in order
property-path-editor-alternative-tooltip = Alternative path — matches either branch
property-path-editor-alternative-add = Alternative
property-path-editor-inverse-tooltip = Inverse path — traverses the predicate in reverse
property-path-editor-zero-or-more-tooltip = Zero or more (*) — repeats this path any number of times, including zero
property-path-editor-one-or-more-tooltip = One or more (+) — repeats this path one or more times
property-path-editor-zero-or-one-tooltip = Zero or one (?) — this path is optional
property-path-editor-add-title = Add path item
property-path-editor-edit-title = Edit path item
property-path-editor-add-predicate-label = Predicate
property-path-editor-add-type-label = Path type
property-path-editor-add-cancel = Cancel
property-path-editor-add-save = Save
property-path-editor-edit = Edit
property-path-editor-remove = Remove
property-path-editor-add-type-predicate = Predicate
property-path-editor-add-type-sequence = Sequence
property-path-editor-add-type-alternative = Alternative
property-path-editor-add-type-inverse = Inverse
property-path-editor-add-type-zero-or-more = Zero or more
property-path-editor-add-type-one-or-more = One or more
property-path-editor-add-type-zero-or-one = Zero or one
property-path-editor-add-predicate-in-use = Already in use
property-path-editor-add-predicate-from-lov = Suggestions
property-editor-property = Property
property-editor-group = Group
property-editor-edit =
    .aria-label = Edit { $label }
property-editor-remove = Remove property
property-editor-edit-title = Edit <label>{ $label }</label>
property-editor-new-property-title = New property
property-editor-new-group-title = New group
property-editor-save = Save
property-editor-cancel = Cancel
property-editor-empty = No properties yet.
property-editor-add-property = Add a property
property-editor-add-group = Add a group
property-editor-unused-groups = Unused groups
property-editor-unused-groups-description = Groups this shape doesn't use yet. Drop a property or a group on one to start using it.
property-editor-delete-group = Delete group
property-editor-delete-group-title = Delete group?
property-editor-delete-group-message = Delete { $label }? What is in it will no longer be in a group.
property-editor-delete-group-used-by = { $count ->
    [one] It is also used by this other shape:
   *[other] It is also used by these other shapes:
}
property-editor-delete-group-cancel = Cancel
property-editor-delete-group-confirm = Delete
cardinality-property-group-required = Required
cardinality-property-group-multiple = Multiple
cardinality-property-group-advanced = Advanced
datatype-xsd-string = Text
datatype-rdf-langstring = Text with language
datatype-xsd-anyuri = URI
datatype-xsd-normalizedstring = Normalized text
datatype-xsd-token = Token
datatype-xsd-language = Language tag
datatype-xsd-name = XML name
datatype-xsd-ncname = XML name (no colon)
datatype-xsd-nmtoken = XML token
datatype-xsd-hexbinary = Binary (hex)
datatype-xsd-base64binary = Binary (base64)
datatype-xsd-boolean = Boolean
datatype-xsd-integer = Whole number
datatype-xsd-decimal = Decimal number
datatype-xsd-double = Double
datatype-xsd-float = Float
datatype-xsd-long = Long integer
datatype-xsd-int = Integer (32-bit)
datatype-xsd-short = Short integer
datatype-xsd-byte = Byte
datatype-xsd-nonnegativeinteger = Non-negative whole number
datatype-xsd-nonpositiveinteger = Non-positive whole number
datatype-xsd-negativeinteger = Negative whole number
datatype-xsd-positiveinteger = Positive whole number
datatype-xsd-unsignedlong = Unsigned long integer
datatype-xsd-unsignedint = Unsigned integer
datatype-xsd-unsignedshort = Unsigned short integer
datatype-xsd-unsignedbyte = Unsigned byte
datatype-xsd-date = Date
datatype-xsd-datetime = Date and time
datatype-xsd-gyear = Year
datatype-xsd-gyearmonth = Year and month
datatype-xsd-gmonthday = Month and day
datatype-xsd-gday = Day
datatype-custom-option = Use custom IRI…
iri-editor-suggestion-suggested = Suggested
iri-editor-suggestion-in-use = Already in use
iri-editor-suggestion-from-lov = Suggestions
iri-editor-suggestion-type-class = class
iri-editor-suggestion-type-property = property
widget-render-error = This field could not be displayed.
focus-node-editor =
    .label = Identifier
    .description = The IRI that identifies this resource.
focus-node-editor-invalid = Enter an absolute IRI, such as https://example.org/alice.
focus-node-editor-in-use = This IRI already identifies another resource.
focus-node-editor-pattern = This IRI doesn't match the pattern the shape requires.
diff-added = Added:
diff-removed = Removed:
diff-changed = Changed:
