import type { Quad_Subject } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { bestByLanguage } from "@/helpers/bestByLanguage.ts";
import { localNameLabel } from "@/helpers/localNameLabel.ts";
import { rdfs, sh } from "@/helpers/namespaces.ts";
import { termKey } from "@/helpers/termKey.ts";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";
import { isUnsetPathNode, parsePathNode } from "@/structure/paths/parsePropertyPath.ts";
import { toSparql } from "@/structure/paths/toSparql.ts";
import type { LanguageRange } from "@/types/BCP47.ts";

export type RowLabel = { label?: string; path?: string };

function rowLabel(
  node: Quad_Subject,
  dataGraph: RdfStore,
  languages: LanguageRange[],
  sourcePrefixes: Record<string, string>,
): RowLabel {
  const names = [sh("name"), rdfs("label")].flatMap((predicate) =>
    dataGraph.getQuads(node, predicate).map((quad) => quad.object),
  );
  const label = bestByLanguage(names, languages)?.value;

  const pathNode = dataGraph.getQuads(node, sh("path"))[0]?.object;
  let path: string | undefined;
  if (pathNode && !isUnsetPathNode(pathNode, dataGraph)) {
    try {
      path = toSparql(parsePathNode(pathNode, dataGraph), { prefixed: true, sourcePrefixes });
    } catch {
      path = undefined;
    }
  }
  return { label, path };
}

export function useRowLabel(node: Quad_Subject, dataGraph: RdfStore): RowLabel {
  const { activeLanguage } = useContentLanguage();
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const { sourcePrefixes } = useEnvironment();
  const languages: LanguageRange[] = [activeLanguage, activeInterfaceLanguage, ""];
  return useReactiveRead(
    dataGraph,
    `property-editor-row@${termKey(node)}@${languages.join(",")}`,
    () => rowLabel(node, dataGraph, languages, sourcePrefixes),
  );
}

// What a row is called, for the edit modal's title and the buttons' accessible names.
export const displayName = (node: Quad_Subject, { label, path }: RowLabel) =>
  label ?? path ?? localNameLabel(node) ?? node.value;
