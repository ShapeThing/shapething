import { useEffect, useId, useMemo, useRef, useState, type RefObject } from "react";
import { Localized } from "@fluent/react";
import type { Literal, NamedNode } from "@rdfjs/types";
import { localName } from "@/helpers/localName.ts";
import { Edit } from "@/helpers/icons.tsx";
import { rdfs, sh } from "@/helpers/namespaces.ts";
import language from "@/resolution/language.ts";
import AutoCompleteOption from "@/outputs/render/components/AutoCompleteOption/index.tsx";
import ValueChip from "@/outputs/render/components/ValueChip/index.tsx";
import { useDataGraphObjects } from "@/outputs/render/hooks/useDataGraphObjects.tsx";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";

type ClassNode = {
  term: NamedNode;
  label: string;
  children: ClassNode[];
};

// A class is an ontology term, not instance data - rdfs:label for it conventionally lives in
// shapesGraph, alongside the rdfs:subClassOf declarations themselves (see PropertyUIElement.ts's
// own ontologyLabel), rather than dataGraph, where valueNodeLabel looks for value nodes. Checking
// both stores keeps this working whether an rdfs:label happens to be asserted alongside the
// ontology or alongside the data.
function classLabel(shape: PropertyUIElement, term: NamedNode): string {
  const labels = [
    ...shape.shapesGraph.getQuads(term, rdfs("label")),
    ...shape.dataGraph.getQuads(term, rdfs("label")),
  ].map((quad) => quad.object as Literal);

  return (labels.length > 0 ? language(labels) : undefined)?.value ?? localName(term) ?? term.value;
}

// Walks rdfs:subClassOf downward from `root`, the same relation keepMostSpecificClasses in
// PropertyUIElement.ts reads upward - both look for it on shapesGraph, since that's where this
// codebase's fixtures declare ontology structure (rdfs:subClassOf, rdfs:label) alongside shapes.
// `seen` guards against a cyclical subClassOf graph, which would otherwise recurse forever.
function buildHierarchy(shape: PropertyUIElement, root: NamedNode, seen: Set<string>): ClassNode {
  seen.add(root.value);
  const children = shape.shapesGraph
    .getQuads(null, rdfs("subClassOf"), root)
    .map((quad) => quad.subject as NamedNode)
    .filter((child) => !seen.has(child.value))
    .map((child) => buildHierarchy(shape, child, seen));

  return { term: root, label: classLabel(shape, root), children };
}

// Keeps a node whose own label matches `query` together with its whole subtree (so a category hit
// still shows what's under it), or - failing that - keeps it anyway if some descendant matches, but
// trimmed down to only the matching branches. This is what surfaces a match's ancestor chain (e.g.
// searching "Dog" still shows Animal > Mammal above it) instead of flattening the result to hits alone.
function filterTree(node: ClassNode, query: string): ClassNode | undefined {
  if (node.label.toLowerCase().includes(query)) return node;

  const filteredChildren = node.children
    .map((child) => filterTree(child, query))
    .filter((child): child is ClassNode => child !== undefined);

  return filteredChildren.length > 0 ? { ...node, children: filteredChildren } : undefined;
}

// Pre-order flattening of the (possibly filtered) tree - the order rows actually appear in the DOM
// top to bottom, used as the roving keyboard-nav index (see activeIndex below).
function flattenTree(node: ClassNode): ClassNode[] {
  return [node, ...node.children.flatMap(flattenTree)];
}

function SubClassTreeNode({
  node,
  inputType,
  groupName,
  isChecked,
  activeTerm,
  rowRefs,
  onToggle,
}: {
  node: ClassNode;
  inputType: "checkbox" | "radio";
  groupName: string;
  isChecked: (term: NamedNode) => boolean;
  activeTerm: string | undefined;
  rowRefs: RefObject<Map<string, HTMLLabelElement>>;
  onToggle: (term: NamedNode, checked: boolean) => void;
}) {
  return (
    <div className="st-subclass-tree__node">
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
          // Keyboard nav is entirely driven by the search input above (arrow keys/enter, see
          // onKeyDown below) - mirrors AutoCompleteEditor/EnumSelectEditor, whose result rows
          // aren't part of the tab order either, and sidesteps radio groups' native arrow-key
          // behaviour, which would otherwise apply a value the moment it's merely arrowed past.
          tabIndex={-1}
        />
        {node.label}
      </label>
      {node.children.length > 0 && (
        <div className="st-subclass-tree__children">
          {node.children.map((child) => (
            <SubClassTreeNode
              key={child.term.value}
              node={child}
              inputType={inputType}
              groupName={groupName}
              isChecked={isChecked}
              activeTerm={activeTerm}
              rowRefs={rowRefs}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SubClassEditor({ shape, term, setTerm }: WidgetProps) {
  const rootClass = shape.getOne(sh("rootClass"));
  // Mirrors meta.ts's singleUnifiedWidget: no sh:maxCount means unbounded, so only an explicit
  // maxCount of 1 rules out a second value ever existing for this property.
  const maxCount = parseFloat(shape.getOne(sh("maxCount"))?.value ?? "Infinity");
  const isMultiValued = maxCount !== 1;
  const inputType: "checkbox" | "radio" = isMultiValued ? "checkbox" : "radio";
  // singleUnifiedWidget means this is the only instance for the whole property - it owns the full
  // value set via `shape` directly (read here, written in toggle() below) rather than the single
  // term/setTerm pair every other widget is limited to. Only meaningful when isMultiValued.
  const selectedObjects = useDataGraphObjects(shape);
  const groupName = useId();
  const [mode, setMode] = useState<"view" | "edit">(
    (isMultiValued ? selectedObjects.length > 0 : term.value !== "") ? "view" : "edit",
  );
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Map<string, HTMLLabelElement>>(new Map());

  const tree = useMemo(
    () =>
      rootClass?.termType === "NamedNode" ? buildHierarchy(shape, rootClass, new Set()) : undefined,
    [shape, rootClass],
  );

  const query = search.trim().toLowerCase();
  const filteredTree = useMemo(
    () => (tree && query ? filterTree(tree, query) : tree),
    [tree, query],
  );
  const visibleItems = useMemo(
    () => (filteredTree ? flattenTree(filteredTree) : []),
    [filteredTree],
  );
  const activeTerm = visibleItems[activeIndex]?.term.value;

  // A fresh set of matches invalidates whatever the previous search had highlighted.
  useEffect(() => {
    setActiveIndex(-1);
  }, [visibleItems]);

  useEffect(() => {
    if (mode === "edit") searchRef.current?.focus();
  }, [mode]);

  // Jumps the (possibly long) tree to whatever's currently highlighted - including the property's
  // existing value the moment the tree opens (see openEditor), so a value nested deep in the
  // hierarchy doesn't open scrolled to the top with no indication of where it actually is.
  useEffect(() => {
    if (mode === "edit" && activeTerm) {
      rowRefs.current.get(activeTerm)?.scrollIntoView({ block: "nearest" });
    }
  }, [mode, activeTerm]);

  const currentLabel =
    term.termType === "NamedNode" && term.value ? classLabel(shape, term) : undefined;

  const isChecked = (candidate: NamedNode): boolean =>
    isMultiValued
      ? selectedObjects.some((object) => object.value === candidate.value)
      : candidate.value === term.value;

  const openEditor = () => {
    const anchor = isMultiValued ? selectedObjects[0]?.value : term.value;
    setActiveIndex(visibleItems.findIndex((item) => item.term.value === anchor));
    setMode("edit");
  };

  const closeEditor = () => {
    setSearch("");
    setMode("view");
  };

  // Single-valued: picking a class replaces this instance's own term and closes, same as ever.
  // Multi-valued: this is the property's only widget instance (see meta.ts's singleUnifiedWidget),
  // so it owns the whole value set directly via `shape` - toggling a box adds/removes right away
  // and leaves the panel open for further picks (mousedown on the row keeps focus on the search
  // input throughout, so nothing here trips the container's onBlur close).
  const toggle = (candidate: NamedNode, checked: boolean) => {
    if (!isMultiValued) {
      setTerm(candidate);
      closeEditor();
      return;
    }
    if (checked) shape.addObject(candidate);
    else shape.removeObject(candidate);
  };

  return (
    <div
      ref={containerRef}
      className="st-subclass"
      onBlur={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget as Node | null)) closeEditor();
      }}
    >
      {isMultiValued ? (
        <div className="st-subclass__pills">
          {selectedObjects.map((object) => (
            <ValueChip
              key={object.value}
              term={object}
              label={object.termType === "NamedNode" ? classLabel(shape, object) : object.value}
              onRemove={() => shape.removeObject(object)}
            />
          ))}
        </div>
      ) : (
        <span tabIndex={0} className="st-subclass__label">
          <AutoCompleteOption term={term} label={currentLabel} />
        </span>
      )}
      <Localized id="autocomplete-edit-value" attrs={{ "aria-label": true }}>
        <button
          type="button"
          className="st-button st-edit-button"
          aria-label="Edit"
          onClick={() => (mode === "edit" ? closeEditor() : openEditor())}
        >
          <Edit />
        </button>
      </Localized>

      {mode === "edit" && (
        <div className="st-subclass__panel" data-block-fly-out>
          <Localized id="autocomplete-search-placeholder" attrs={{ placeholder: true }}>
            <input
              ref={searchRef}
              type="text"
              className="st-input"
              placeholder="Search…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  if (search) setSearch("");
                  else searchRef.current?.blur();
                } else if (event.key === "ArrowDown" && visibleItems.length > 0) {
                  event.preventDefault();
                  setActiveIndex((index) => (index + 1) % visibleItems.length);
                } else if (event.key === "ArrowUp" && visibleItems.length > 0) {
                  event.preventDefault();
                  setActiveIndex((index) => (index <= 0 ? visibleItems.length - 1 : index - 1));
                } else if (event.key === "Home" && visibleItems.length > 0) {
                  event.preventDefault();
                  setActiveIndex(0);
                } else if (event.key === "End" && visibleItems.length > 0) {
                  event.preventDefault();
                  setActiveIndex(visibleItems.length - 1);
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  const target = visibleItems[activeIndex] ?? visibleItems[0];
                  if (target) toggle(target.term, isMultiValued ? !isChecked(target.term) : true);
                }
              }}
            />
          </Localized>

          <div className="st-subclass-tree" role={inputType === "radio" ? "radiogroup" : "group"}>
            {filteredTree ? (
              <SubClassTreeNode
                node={filteredTree}
                inputType={inputType}
                groupName={groupName}
                isChecked={isChecked}
                activeTerm={activeTerm}
                rowRefs={rowRefs}
                onToggle={toggle}
              />
            ) : (
              <div className="st-subclass-tree__empty">
                <Localized id="autocomplete-no-results">No results found</Localized>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
