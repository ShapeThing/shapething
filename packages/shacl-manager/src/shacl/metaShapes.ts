import { metaShapes } from "../app/MetaView.tsx";
import shapeLayout from "./shapes/shape.edit.ttl?raw";
import shape from "./shapes/shape.ttl?raw";
import propertyLayout from "./shapes/property.edit.ttl?raw";
import property from "./shapes/property.ttl?raw";
import queryLayout from "./shapes/query.edit.ttl?raw";
import query from "./shapes/query.ttl?raw";
import ruleLayout from "./shapes/rule.edit.ttl?raw";
import rule from "./shapes/rule.ttl?raw";

const base = "http://shapething.com/shacl-manager";

export const shaclMeta = {
  shape: metaShapes(shape, shapeLayout, `${base}/meta#shape`),
  property: metaShapes(property, propertyLayout, `${base}/property-meta#shape`),
  query: metaShapes(query, queryLayout, `${base}/query-meta#shape`),
  rule: metaShapes(rule, ruleLayout, `${base}/rule-meta#shape`),
};
