import { metaShapes } from "../app/MetaView.tsx";
import classLayout from "./shapes/class.edit.ttl?raw";
import cls from "./shapes/class.ttl?raw";
import propertyLayout from "./shapes/property.edit.ttl?raw";
import property from "./shapes/property.ttl?raw";

const base = "http://shapething.com/shacl-manager";

export const owlMeta = {
  class: metaShapes(cls, classLayout, `${base}/owl-meta#class`),
  property: metaShapes(property, propertyLayout, `${base}/owl-property-meta#property`),
};
