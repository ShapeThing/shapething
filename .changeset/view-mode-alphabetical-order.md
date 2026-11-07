---
"@shapething/shacl-renderer": minor
---

View mode lists a property's values alphabetically by the label they are shown with, as the content language sorts ("Épopée" among the E's, "Book 2" before "Book 10"), where before they were in whatever order the data gave. With `st:orderBy` they are still listed by their position, and alphabetically between values that share one or have none. Edit mode is unchanged: without `st:orderBy` its values stay in the order they were added in.
