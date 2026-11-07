---
"@shapething/shacl-renderer": minor
---

New `st:DateViewer`: shows `xsd:date`, `xsd:dateTime`, `xsd:dateTimeStamp`, `xsd:gYear` and `xsd:gYearMonth` values as the interface language writes them ("11 November 1855", "384 BC") instead of their lexical form. It is picked by score for any date value or `sh:datatype`, so generated shapes get it too. A dateTime at midnight reads as a date.
