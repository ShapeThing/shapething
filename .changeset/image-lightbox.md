---
"@shapething/shacl-renderer": minor
---

New `enableImageLightbox` environment option (and web component attribute), on by default: a click on an image of `shui:ImageViewer` opens it in a PhotoSwipe lightbox, zooming from the thumbnail, as a gallery of every image on the screen, instead of opening the original in a new tab. Clicks with a modifier key still follow the link. PhotoSwipe is only loaded on the first click. The radius of the image's corners in the lightbox is the `--image-lightbox-radius` custom property on `.pswp` (16px).
