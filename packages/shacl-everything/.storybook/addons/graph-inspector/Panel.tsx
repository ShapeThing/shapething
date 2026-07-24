import React from "react";
import { useState } from "react";
import { useChannel, useStorybookState } from "storybook/manager-api";
import { GRAPH_INSPECTOR_EVENT } from "./constants.ts";
import type { GraphInspectorPayload, GraphText } from "./constants.ts";
import { TurtleCode } from "./TurtleCode.tsx";
import { splitPrefixes } from "./splitPrefixes.ts";

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
  const sameSource =
    payload?.shapesGraph?.href !== undefined && payload.shapesGraph.href === payload?.dataGraph?.href;

  return (
    <div
      style={{
        display: "flex",
        flexDirection,
        gap: 20,
        padding: 12,
        background: "#fff",
        color: "#1a1a1a",
        height: "100%",
        boxSizing: "border-box",
      }}
    >
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

const GraphSection = ({ title, graph }: { title: string; graph?: GraphText }) => {
  if (!graph) return null;

  const { prefixText, bodyText } =
    graph.text !== undefined ? splitPrefixes(graph.text) : { prefixText: "", bodyText: "" };
  const prefixCount = prefixText ? prefixText.split("\n").filter(Boolean).length : 0;

  return (
    <section
      style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}
    >
      <h3 style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
        {title}{" "}
        <span style={{ fontWeight: 400, opacity: 0.6 }}>
          —{" "}
          {graph.href ? (
            <a href={graph.href} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
              {decodeURI(graph.label)}
            </a>
          ) : (
            graph.label
          )}
        </span>
      </h3>
      {graph.text !== undefined ? (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          {prefixCount > 0 && (
            <details style={{ marginBottom: 6, flexShrink: 0 }}>
              <summary
                style={{ cursor: "pointer", fontSize: 11, opacity: 0.6, userSelect: "none" }}
              >
                {prefixCount} prefix declaration{prefixCount === 1 ? "" : "s"}
              </summary>
              <pre style={{ ...preStyle, maxHeight: 200 }}>
                <TurtleCode text={prefixText} />
              </pre>
            </details>
          )}
          <pre style={{ ...preStyle, flex: 1, minHeight: 0 }}>
            <TurtleCode text={bodyText} />
          </pre>
        </div>
      ) : (
        <p style={{ opacity: 0.6, fontSize: 12 }}>
          No raw source text - a parsed store or quad array was passed directly.
        </p>
      )}
    </section>
  );
};
