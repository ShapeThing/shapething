import React from "react";
import { useState } from "react";
import { useChannel, useStorybookState } from "storybook/manager-api";
import { SUBMIT_PREVIEW_EVENT } from "./constants.ts";
import type { SubmitPreviewPayload } from "./constants.ts";
import { TurtleCode } from "../graph-inspector/TurtleCode.tsx";
import { splitPrefixes, parsePrefixMap } from "../graph-inspector/splitPrefixes.ts";

type Props = {
  active: boolean;
};

export const SubmitPreviewPanel = ({ active }: Props) => {
  const { storyId } = useStorybookState();
  const [payloadsByStory, setPayloadsByStory] = useState<Record<string, SubmitPreviewPayload>>({});
  // Only meaningful once a payload with resourceOnly text exists, but kept independent of that so
  // flipping stories doesn't silently reset the reviewer's chosen mode.
  const [showResourceOnly, setShowResourceOnly] = useState(true);

  useChannel({
    [SUBMIT_PREVIEW_EVENT]: (payload: SubmitPreviewPayload) => {
      setPayloadsByStory((prev) => ({ ...prev, [payload.storyId]: payload }));
    },
  });

  if (!active) return null;

  const payload = payloadsByStory[storyId];
  const hasResourceOnly = payload?.resourceOnly !== undefined;
  const dataGraphMode = showResourceOnly && hasResourceOnly ? "resourceOnly" : "full";

  const sections = payload
    ? [
        {
          key: "dataGraph",
          title: undefined,
          accent: "#0550ae",
          text:
            dataGraphMode === "resourceOnly" ? (payload.resourceOnly as string) : payload.dataGraph,
        },
        { key: "additions", title: "Additions", accent: "#116329", text: payload.additions },
        { key: "deletions", title: "Deletions", accent: "#cf222e", text: payload.deletions },
      ].map((section) => ({ ...section, ...splitPrefixes(section.text) }))
    : [];

  // The three turtle blocks are written independently (see withSubmitPreview.tsx), so each only
  // declares the prefixes its own quads happen to use - merge them into one deduplicated block so
  // the panel shows a single prefix declaration list instead of three near-identical ones.
  const prefixLines = new Set<string>();
  sections.forEach((section) => {
    section.prefixText
      .split("\n")
      .filter(Boolean)
      .forEach((line) => prefixLines.add(line));
  });
  const combinedPrefixText = [...prefixLines].sort().join("\n");
  const prefixMap = parsePrefixMap(combinedPrefixText);
  const prefixCount = prefixLines.size;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        padding: 12,
        background: "#fff",
        color: "#1a1a1a",
        height: "100%",
        boxSizing: "border-box",
        overflow: "auto",
      }}
    >
      {!payload ? (
        <p style={{ opacity: 0.6, fontSize: 13 }}>
          Submit the edit mode form on this story to see the result here.
        </p>
      ) : (
        <>
          {prefixCount > 0 && (
            <details style={{ marginBottom: 6 }}>
              <summary
                style={{ cursor: "pointer", fontSize: 11, opacity: 0.6, userSelect: "none" }}
              >
                {prefixCount} prefix declaration{prefixCount === 1 ? "" : "s"}
              </summary>
              <pre style={{ ...preStyle, maxHeight: 200 }}>
                <TurtleCode text={combinedPrefixText} prefixes={prefixMap} />
              </pre>
            </details>
          )}
          {sections.map(({ key, title, accent, bodyText }) => (
            <TurtleSection
              key={key}
              accent={accent}
              text={bodyText}
              prefixes={prefixMap}
              heading={
                title ?? (
                  <DataGraphModeToggle
                    mode={dataGraphMode}
                    disabled={!hasResourceOnly}
                    onChange={setShowResourceOnly}
                  />
                )
              }
            />
          ))}
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

const TurtleSection = ({
  heading,
  accent,
  text,
  prefixes,
}: {
  heading: React.ReactNode;
  accent: string;
  text: string;
  prefixes: Record<string, string>;
}) => (
  <section>
    <h3 style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: accent }}>{heading}</h3>
    {text.trim() ? (
      <pre style={preStyle}>
        <TurtleCode text={text} prefixes={prefixes} />
      </pre>
    ) : (
      <p style={{ opacity: 0.6, fontSize: 12, margin: 0 }}>(none)</p>
    )}
  </section>
);

// Replaces the old static "Data graph" heading: lets the reviewer flip between the full submitted
// dataGraph and the same resource-fetcher-scoped description the real app renders (see
// resourceOnlyQuads in withSubmitPreview.tsx). Disabled when the story has no focusNode, since
// there's nothing to scope a resource-only description to.
const DataGraphModeToggle = ({
  mode,
  disabled,
  onChange,
}: {
  mode: "full" | "resourceOnly";
  disabled: boolean;
  onChange: (showResourceOnly: boolean) => void;
}) => (
  <span style={{ display: "inline-flex", gap: 2 }}>
    {(
      [
        { value: "resourceOnly", label: "Resource only" },
        { value: "full", label: "Data graph" },
      ] as const
    ).map(({ value, label }) => (
      <button
        key={value}
        type="button"
        disabled={disabled}
        onClick={() => onChange(value === "resourceOnly")}
        style={{
          font: "inherit",
          fontWeight: 600,
          fontSize: 13,
          padding: "2px 8px",
          borderRadius: 4,
          border: "1px solid rgba(128, 128, 128, 0.4)",
          background: mode === value ? "#0550ae" : "transparent",
          color: disabled ? "rgba(128, 128, 128, 0.6)" : mode === value ? "#fff" : "#0550ae",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        {label}
      </button>
    ))}
  </span>
);
