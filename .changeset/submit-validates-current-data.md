---
"@shapething/shacl-renderer": patch
---

Submitting an edit form decides on the data as it is at that moment. A value typed just before pressing Enter is written first (text fields only wrote on leaving them), and the form is validated afresh instead of trusting the last live validation, which could still describe the form before the edit. Before, typing a required value and pressing Enter or quickly clicking Create did nothing, and a value emptied just before submitting could get through.
