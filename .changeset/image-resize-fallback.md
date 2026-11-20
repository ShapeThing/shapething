---
"@shapething/shacl-renderer": minor
---

All images go through one mechanism (`useResizedImage`): the depictions and icons of LabelViewer, AutoCompleteOption, Teaser and RadiosCheckboxesEditor now respect `enableImageResizing` like `shui:ImageViewer`, instead of always going through wsrv.nl. A resized image that fails falls back to the original URL (wsrv.nl redirects there with `default=1`, and the image is retried at its original URL when wsrv.nl itself fails), so images rate limited by their host (such as Wikimedia) are still shown.
