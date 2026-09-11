import type { RefObject } from "react";
import { Localized } from "@fluent/react";
import type { NamedNode } from "@rdfjs/types";
import { highlightMatches } from "@/helpers/highlightMatches.tsx";
import { termKey } from "@/helpers/termKey.ts";
import type { ClassNode } from "@/structure/classHierarchy.ts";
import "./style.css";

type NodeProps = {
  node: ClassNode;
  query: string;
  inputType: "checkbox" | "radio";
  groupName: string;
  isChecked: (term: NamedNode) => boolean;
  activeTerm: string | undefined;
  rowRefs: RefObject<Map<string, HTMLLabelElement>>;
  valueCounts: Map<string, number> | undefined;
  onToggle: (term: NamedNode, checked: boolean) => void;
};

function ClassHierarchyTreeNode({
  node,
  query,
  inputType,
  groupName,
  isChecked,
  activeTerm,
  rowRefs,
  valueCounts,
  onToggle,
}: NodeProps) {
  // filterClassTree keeps a non-matching node around when some descendant of it matches, purely as
  // a tree-structure carrier - it renders no row of its own while searching, only whichever of its
  // descendants actually match. The caller's flattenVisibleClassNodes-derived keyboard nav stays in
  // sync with this same check.
  const matches = !query || node.label.toLowerCase().includes(query);

  return (
    <div className="st-class-tree__node">
      {matches && (
        <label
          ref={(el) => {
            if (el) rowRefs.current.set(node.term.value, el);
            else rowRefs.current.delete(node.term.value);
          }}
          className={`st-option ${node.term.value === activeTerm ? "st-option--active" : ""}`}
          // Keeps focus on the search input during the click, exactly like AutoCompleteEditor's and
          // EnumSelectEditor's own result rows - without this, the mousedown shifts focus onto this
          // label/input first, which fires the container's onBlur and closes the panel before the
          // click that follows ever reaches this row, so the click intermittently does nothing. For
          // the checkbox (multi-value) case, it also keeps the panel open across several picks -
          // there's nowhere else for focus to land that onBlur would treat as "outside".
          onMouseDown={(event) => event.preventDefault()}
        >
          <input
            type={inputType}
            className="st-checkbox"
            name={inputType === "radio" ? groupName : undefined}
            checked={isChecked(node.term)}
            onChange={(event) => onToggle(node.term, event.target.checked)}
            // Keyboard nav is entirely driven by the caller's own search input (arrow keys/enter) -
            // mirrors AutoCompleteEditor/EnumSelectEditor, whose result rows aren't part of the tab
            // order either, and sidesteps radio groups' native arrow-key behaviour, which would
            // otherwise apply a value the moment it's merely arrowed past.
            tabIndex={-1}
          />
          {/* A single wrapping element, not the highlightMatches() array directly - .st-option is a
          flex container with a `gap`, which would otherwise land between every text/mark fragment
          the array produces instead of just once between the checkbox and the label. */}
          <span>{highlightMatches(node.label, query, "st-class-tree__match")}</span>
          {valueCounts && (
            <span className="st-class-tree__count"> ({valueCounts.get(termKey(node.term)) ?? 0})</span>
          )}
        </label>
      )}
      {node.children.length > 0 && (
        <div className="st-class-tree__children">
          {node.children.map((child) => (
            <ClassHierarchyTreeNode
              key={child.term.value}
              node={child}
              query={query}
              inputType={inputType}
              groupName={groupName}
              isChecked={isChecked}
              activeTerm={activeTerm}
              rowRefs={rowRefs}
              valueCounts={valueCounts}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export type ClassHierarchyTreeProps = {
  tree: ClassNode | undefined;
  query: string;
  inputType: "checkbox" | "radio";
  groupName: string;
  isChecked: (term: NamedNode) => boolean;
  activeTerm: string | undefined;
  rowRefs: RefObject<Map<string, HTMLLabelElement>>;
  onToggle: (term: NamedNode, checked: boolean) => void;
  // Only ever given by st:SubClassFacet (Environment.enableFacetOptionCounts) - shui:SubClassEditor
  // has no notion of per-option counts and simply never passes this.
  valueCounts?: Map<string, number>;
};

/**
 * The recursive rdfs:subClassOf tree both shui:SubClassEditor and st:SubClassFacet render inside
 * their own dropdown panel - shared because it's the same non-trivial recursive rendering (search
 * highlighting, checkbox/radio toggling, roving-keyboard-nav row refs) for both, built from the
 * same structure/classHierarchy.ts helpers. Purely presentational/controlled: open/close, search
 * text, and keyboard nav all live in the caller (see either widget's own widget.tsx), which passes
 * in `activeTerm`/`rowRefs` and reacts to `onToggle`.
 */
export default function ClassHierarchyTree({
  tree,
  query,
  inputType,
  groupName,
  isChecked,
  activeTerm,
  rowRefs,
  valueCounts,
  onToggle,
}: ClassHierarchyTreeProps) {
  return (
    <div className="st-class-tree" role={inputType === "radio" ? "radiogroup" : "group"}>
      {tree ? (
        <ClassHierarchyTreeNode
          node={tree}
          query={query}
          inputType={inputType}
          groupName={groupName}
          isChecked={isChecked}
          activeTerm={activeTerm}
          rowRefs={rowRefs}
          valueCounts={valueCounts}
          onToggle={onToggle}
        />
      ) : (
        <div className="st-class-tree__empty">
          <Localized id="autocomplete-no-results">No results found</Localized>
        </div>
      )}
    </div>
  );
}
