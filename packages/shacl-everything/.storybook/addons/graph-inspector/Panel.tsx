import React from "react";
import { useState } from "react";
import { useChannel, useStorybookState } from "storybook/manager-api";
import { GRAPH_INSPECTOR_EVENT } from "./constants.ts";
import type { GraphFileText, GraphInspectorPayload, GraphText } from "./constants.ts";
import { TurtleCode } from "./TurtleCode.tsx";
import { splitPrefixes, parsePrefixMap, formatPrefixDeclarations } from "./splitPrefixes.ts";
import { prefixes as wellKnownPrefixes } from "../../../src/helpers/namespaces.ts";
import type { SpecId, SpecUsage } from "../../../src/analysis/specUsage.ts";
import type { DetectedPattern } from "../../../src/analysis/patterns.ts";

type Props = {
  active: boolean;
};

export const GraphInspectorPanel = ({ active }: Props) => {
  const { storyId, layout } = useStorybookState();
  const [payloadsByStory, setPayloadsByStory] = useState<Record<string, GraphInspectorPayload>>({});

  useChannel({
    [GRAPH_INSPECTOR_EVENT]: (payload: GraphInspectorPayload) => {
      setPayloadsByStory((prev) => ({ ...prev, [payload.storyId]: payload }));
    },
  });

  if (!active) return null;

  const payload = payloadsByStory[storyId];
  // Right-docked panel is narrow and tall - stack the two graphs. Bottom-docked is wide and
  // short - put them side by side.
  const flexDirection = layout.panelPosition === "right" ? "column" : "row";
  const shapesGraphKey = graphFilesKey(payload?.shapesGraph);
  const sameSource =
    shapesGraphKey !== undefined && shapesGraphKey === graphFilesKey(payload?.dataGraph);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: 12,
        background: "#fff",
        color: "#1a1a1a",
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      <SpecAnalysisSummary specUsage={payload?.specUsage} patterns={payload?.patterns} />
      <div style={{ display: "flex", flexDirection, gap: 20, flex: 1, minHeight: 0 }}>
        {!payload ? (
          <p style={{ opacity: 0.6, fontSize: 13 }}>No shapes or data graph on this story.</p>
        ) : sameSource ? (
          <GraphSection title="Shapes & data graph" graph={payload.shapesGraph} />
        ) : (
          <>
            <GraphSection title="Shapes graph" graph={payload.shapesGraph} />
            <GraphSection title="Data graph" graph={payload.dataGraph} />
          </>
        )}
      </div>
    </div>
  );
};

// A distinguishable, light-background-readable color per SpecId - purely a display concern of
// this addon, not the library (which has no notion of "color", only spec/count/percentage data).
const SPEC_COLORS: Record<SpecId, string> = {
  "shacl-core-1": "#6366f1",
  "shacl-core-1-2": "#22c55e",
  "shacl-ui-1-2": "#f59e0b",
  dash: "#ec4899",
  shapething: "#0ea5e9",
};

const SpecAnalysisSummary = ({
  specUsage,
  patterns,
}: {
  specUsage?: SpecUsage[];
  patterns?: DetectedPattern[];
}) => {
  const hasSpecUsage = !!specUsage?.length;
  const hasPatterns = !!patterns?.length;
  if (!hasSpecUsage && !hasPatterns) return null;

  return (
    <section style={{ flexShrink: 0, marginBottom: 16 }}>
      {hasSpecUsage && (
        <div style={{ marginBottom: hasPatterns ? 12 : 0 }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600 }}>
            Spec usage <span style={{ fontWeight: 400, opacity: 0.6 }}>— shapes graph</span>
          </h3>
          <div
            style={{
              display: "flex",
              height: 10,
              borderRadius: 4,
              overflow: "hidden",
              border: "1px solid rgba(128, 128, 128, 0.3)",
            }}
          >
            {specUsage.map((usage) => (
              <div
                key={usage.spec}
                title={`${usage.label}: ${usage.percentage.toFixed(1)}% (${usage.count} terms)`}
                style={{
                  width: `${usage.percentage}%`,
                  background: SPEC_COLORS[usage.spec] ?? "#999",
                }}
              />
            ))}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              columnGap: 14,
              rowGap: 4,
              marginTop: 6,
              fontSize: 11,
              opacity: 0.85,
            }}
          >
            {specUsage.map((usage) => (
              <span key={usage.spec} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: SPEC_COLORS[usage.spec] ?? "#999",
                    flexShrink: 0,
                  }}
                />
                {usage.label} — {usage.percentage.toFixed(1)}%
              </span>
            ))}
          </div>
        </div>
      )}

      {hasPatterns && (
        <div>
          <h3 style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600 }}>Detected patterns</h3>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
            {patterns.map((pattern) => (
              <li key={pattern.pattern} title={pattern.description}>
                {pattern.label} <span style={{ opacity: 0.6 }}>({pattern.count})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

const preStyle: React.CSSProperties = {
  margin: 0,
  padding: 8,
  border: "1px solid rgba(128, 128, 128, 0.3)",
  borderRadius: 4,
  overflow: "auto",
  fontSize: 12,
  lineHeight: 1.5,
  fontFamily: "ui-monospace, SFMono-Regular, SF Mono, Consolas, Liberation Mono, Menlo, monospace",
};

// Identifies a graph purely by the ordered hrefs of its constituent files, so the "shapes & data
// graph are the same source" collapse below also fires when argsByTestFile merges several
// fixture files into one shapesGraph/dataGraph (both built from the same filename list, in the
// same order). undefined (rather than e.g. an empty string) whenever any file lacks an href
// (inline string / parsed store), since those can't be meaningfully deduplicated by source.
const graphFilesKey = (graph?: GraphText): string | undefined => {
  if (!graph || graph.files.length === 0) return undefined;
  if (graph.files.some((file) => file.href === undefined)) return undefined;
  return graph.files.map((file) => file.href).join("\n");
};

const GraphSection = ({ title, graph }: { title: string; graph?: GraphText }) => {
  if (!graph || graph.files.length === 0) return null;

  const sectionSlug = title.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase();
  // Most stories have exactly one file - keep that case's header identical to before (filename
  // inline, next to the section title) rather than introducing a redundant nested heading.
  const singleFile = graph.files.length === 1 ? graph.files[0] : undefined;

  return (
    <section
      style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}
    >
      <h3 style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
        {title}
        {singleFile && (
          <span style={{ fontWeight: 400, opacity: 0.6 }}>
            {" "}
            —{" "}
            {singleFile.href ? (
              <a
                href={singleFile.href}
                target="_blank"
                rel="noreferrer"
                style={{ color: "inherit" }}
              >
                {decodeURI(singleFile.label)}
              </a>
            ) : (
              singleFile.label
            )}
          </span>
        )}
      </h3>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          gap: 16,
          overflow: "auto",
        }}
      >
        {graph.files.map((file, index) => (
          <GraphFileSection
            key={file.href ?? `${sectionSlug}-${index}`}
            file={file}
            idPrefix={`${sectionSlug}-${index}`}
            showHeading={graph.files.length > 1}
          />
        ))}
      </div>
    </section>
  );
};

const GraphFileSection = ({
  file,
  idPrefix,
  showHeading,
}: {
  file: GraphFileText;
  idPrefix: string;
  showHeading: boolean;
}) => {
  const { prefixText: rawPrefixText, bodyText } =
    file.text !== undefined ? splitPrefixes(file.text) : { prefixText: "", bodyText: "" };
  const declaredPrefixes = parsePrefixMap(rawPrefixText);
  const prefixCount = Object.keys(declaredPrefixes).length;
  const prefixText = formatPrefixDeclarations(declaredPrefixes);
  const prefixMap = { ...wellKnownPrefixes, ...declaredPrefixes };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: "1 0 auto" }}>
      {showHeading && (
        <h4 style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 600, opacity: 0.75 }}>
          {file.href ? (
            <a href={file.href} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
              {decodeURI(file.label)}
            </a>
          ) : (
            file.label
          )}
        </h4>
      )}
      {file.text !== undefined ? (
        <>
          {prefixCount > 0 && (
            <details style={{ marginBottom: 6, flexShrink: 0 }}>
              <summary
                style={{ cursor: "pointer", fontSize: 11, opacity: 0.6, userSelect: "none" }}
              >
                {prefixCount} prefix declaration{prefixCount === 1 ? "" : "s"}
              </summary>
              <pre style={{ ...preStyle, maxHeight: 200 }}>
                <TurtleCode
                  text={prefixText}
                  prefixes={prefixMap}
                  idPrefix={`${idPrefix}-prefixes`}
                  baseHref={file.href}
                />
              </pre>
            </details>
          )}
          <pre style={{ ...preStyle, flex: 1, minHeight: 0 }}>
            <TurtleCode
              text={bodyText}
              prefixes={prefixMap}
              idPrefix={`${idPrefix}-body`}
              baseHref={file.href}
            />
          </pre>
        </>
      ) : (
        <p style={{ opacity: 0.6, fontSize: 12 }}>
          No raw source text - a parsed store or quad array was passed directly.
        </p>
      )}
    </div>
  );
};
