// The embed bundle: registers <shacl-renderer> and injects the library stylesheet, so a page only
// needs this one script tag. The element renders into light DOM, so the stylesheet goes into the
// document once, not per element.
import "@shapething/shacl-everything/webcomponent";
import css from "@shapething/shacl-everything/style.css?inline";

const STYLE_ID = "shacl-renderer-embed-style";

if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = css;
  // Prepended, so the embedding page's own stylesheets can still override it.
  document.head.prepend(style);
}
