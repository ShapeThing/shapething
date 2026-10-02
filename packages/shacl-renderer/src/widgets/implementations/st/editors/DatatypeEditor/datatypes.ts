import type { NamedNode } from "@rdfjs/types";
import { rdf, xsd } from "@/helpers/namespaces.ts";

export type CuratedDatatype = { term: NamedNode; ftlId: string };

// Mirrors the exact datatype set @/helpers/castDataTypeTermToJs.ts already knows how to cast/
// render (plus rdf:langString), grouped the same way (String/Boolean/Number/Date) - this picker
// should never offer a datatype the rest of the app doesn't already have a real cast for. The most
// commonly used datatype in each group comes first. Keep this in sync if that file's if-chain ever
// changes.
export const curatedDatatypes: CuratedDatatype[] = [
  // String types
  { term: xsd("string"), ftlId: "datatype-xsd-string" },
  { term: rdf("langString"), ftlId: "datatype-rdf-langstring" },
  { term: xsd("anyURI"), ftlId: "datatype-xsd-anyuri" },
  // { term: xsd("normalizedString"), ftlId: "datatype-xsd-normalizedstring" },
  // { term: xsd("token"), ftlId: "datatype-xsd-token" },
  // { term: xsd("language"), ftlId: "datatype-xsd-language" },
  // { term: xsd("Name"), ftlId: "datatype-xsd-name" },
  // { term: xsd("NCName"), ftlId: "datatype-xsd-ncname" },
  // { term: xsd("NMTOKEN"), ftlId: "datatype-xsd-nmtoken" },
  // { term: xsd("hexBinary"), ftlId: "datatype-xsd-hexbinary" },
  // { term: xsd("base64Binary"), ftlId: "datatype-xsd-base64binary" },
  // Boolean type
  { term: xsd("boolean"), ftlId: "datatype-xsd-boolean" },
  // Number types
  { term: xsd("integer"), ftlId: "datatype-xsd-integer" },
  { term: xsd("decimal"), ftlId: "datatype-xsd-decimal" },
  { term: xsd("double"), ftlId: "datatype-xsd-double" },
  { term: xsd("float"), ftlId: "datatype-xsd-float" },
  { term: xsd("long"), ftlId: "datatype-xsd-long" },
  // { term: xsd("int"), ftlId: "datatype-xsd-int" },
  // { term: xsd("short"), ftlId: "datatype-xsd-short" },
  // { term: xsd("byte"), ftlId: "datatype-xsd-byte" },
  // { term: xsd("nonNegativeInteger"), ftlId: "datatype-xsd-nonnegativeinteger" },
  // { term: xsd("nonPositiveInteger"), ftlId: "datatype-xsd-nonpositiveinteger" },
  // { term: xsd("negativeInteger"), ftlId: "datatype-xsd-negativeinteger" },
  // { term: xsd("positiveInteger"), ftlId: "datatype-xsd-positiveinteger" },
  // { term: xsd("unsignedLong"), ftlId: "datatype-xsd-unsignedlong" },
  // { term: xsd("unsignedInt"), ftlId: "datatype-xsd-unsignedint" },
  // { term: xsd("unsignedShort"), ftlId: "datatype-xsd-unsignedshort" },
  // { term: xsd("unsignedByte"), ftlId: "datatype-xsd-unsignedbyte" },
  // Date types
  { term: xsd("date"), ftlId: "datatype-xsd-date" },
  { term: xsd("dateTime"), ftlId: "datatype-xsd-datetime" },
  { term: xsd("gYear"), ftlId: "datatype-xsd-gyear" },
  { term: xsd("gYearMonth"), ftlId: "datatype-xsd-gyearmonth" },
  { term: xsd("gMonthDay"), ftlId: "datatype-xsd-gmonthday" },
  { term: xsd("gDay"), ftlId: "datatype-xsd-gday" },
];
