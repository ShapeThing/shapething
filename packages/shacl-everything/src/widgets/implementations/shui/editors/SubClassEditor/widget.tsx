import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Localized } from "@fluent/react";
import type { NamedNode, Term } from "@rdfjs/types";
import { factory } from "@/helpers/factory.ts";
import { isAbstract } from "@/helpers/isAbstract.ts";
import { rdf, sh } from "@/helpers/namespaces.ts";
import { valueNodeLabel } from "@/resolution/label.ts";
import ClassHierarchyTree from "@/outputs/render/components/ClassHierarchyTree/index.tsx";
import ValueChip from "@/outputs/render/components/ValueChip/index.tsx";
import { useDataGraphObjects } from "@/outputs/render/hooks/useDataGraphObjects.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import {
  buildClassHierarchy,
  filterClassTree,
  flattenVisibleClassNodes,
} from "@/structure/classHierarchy.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";

export default function SubClassEditor({ shape, term, setTerm, labelledBy }: WidgetProps) {
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const rootClass = shape.get(sh("rootClass"))[0];
  // Mirrors meta.ts's singleUnifiedWidget: no sh:maxCount means unbounded, so only an explicit
  // maxCount of 1 rules out a second value ever existing for this property.
  const maxCount = shape.get(sh("maxCount")) ?? Infinity;
  const isMultiValued = maxCount !== 1;
  const inputType: "checkbox" | "radio" = isMultiValued ? "checkbox" : "radio";
  // singleUnifiedWidget means this is the only instance for the whole property - it owns the full
  // value set via `shape` directly (read here, written in toggle() below) rather than the single
  // term/setTerm pair every other widget is limited to. Only meaningful when isMultiValued.
  const selectedObjects = useDataGraphObjects(shape);
  const groupName = useId();
  // Both arities render through the same pills+input row - single-valued just never has more
  // than one chip, since a fresh pick overwrites `term` directly (see toggle() below).
  const chips: Term[] = isMultiValued ? selectedObjects : term.value ? [term] : [];
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Map<string, HTMLLabelElement>>(new Map());

  const tree = useMemo(
    () =>
      rootClass?.termType === "NamedNode"
        ? buildClassHierarchy(shape, rootClass, new Set(), [activeInterfaceLanguage])
        : undefined,
    [shape, rootClass, activeInterfaceLanguage],
  );

  const query = search.trim().toLowerCase();
  const filteredTree = useMemo(
    () => (tree && query ? filterClassTree(tree, query) : tree),
    [tree, query],
  );
  const visibleItems = useMemo(
    () => (filteredTree ? flattenVisibleClassNodes(filteredTree, query) : []),
    [filteredTree, query],
  );
  const activeTerm = visibleItems[activeIndex]?.term.value;

  // A fresh set of matches invalidates whatever the previous search had highlighted.
  useEffect(() => {
    setActiveIndex(-1);
  }, [visibleItems]);

  // An empty required field opens ready to type, same as ever - mount-only, so removing the last
  // chip later (backspace or a chip's own x) doesn't reopen a panel the user just closed.
  useEffect(() => {
    if (chips.length === 0) searchRef.current?.focus();
  }, []);

  // Jumps the (possibly long) tree to whatever's currently highlighted - including the property's
  // existing value the moment the tree opens (see openPanel), so a value nested deep in the
  // hierarchy doesn't open scrolled to the top with no indication of where it actually is.
  useEffect(() => {
    if (isOpen && activeTerm) {
      rowRefs.current.get(activeTerm)?.scrollIntoView({ block: "nearest" });
    }
  }, [isOpen, activeTerm]);

  // dash:abstract classes can't have direct instances (see helpers/isAbstract.ts) - so when this
  // property *is* the resource's own rdf:type, they stay in the tree (their subclasses are what
  // can be picked) but can't be picked themselves. Classes as plain values of any other property
  // aren't instantiated by picking them, so nothing is disabled there.
  const pathIsRdfType = useMemo(() => {
    const path = shape.propertyPath();
    return path?.type === "predicate" && path.predicate.equals(rdf("type"));
  }, [shape]);
  const isDisabled = pathIsRdfType
    ? (candidate: NamedNode) =>
        !isChecked(candidate) && isAbstract(candidate, [shape.shapesGraph, shape.dataGraph])
    : undefined;

  const isChecked = (candidate: NamedNode): boolean =>
    isMultiValued
      ? selectedObjects.some((object) => object.value === candidate.value)
      : candidate.value === term.value;

  const openPanel = () => {
    const anchor = isMultiValued ? selectedObjects[0]?.value : term.value;
    setActiveIndex(visibleItems.findIndex((item) => item.term.value === anchor));
    setIsOpen(true);
  };

  // Multi-valued: this is the property's only widget instance (see meta.ts's singleUnifiedWidget),
  // so it owns the whole value set directly via `shape` - removing a value works the same whether
  // it comes from a chip's own x or from Backspace on the search input.
  const removeChip = (chip: Term) => {
    if (isMultiValued) shape.removeObject(chip);
    else setTerm(factory.namedNode(""));
  };

  // Single-valued: picking a class replaces this instance's own term and closes the panel, same as
  // ever. Multi-valued: toggling a box adds/removes right away and leaves the panel open for
  // further picks - refocusing the search input afterwards (same as removeChip below) undoes the
  // browser's own focus move onto the checkbox that was just clicked, so typing continues right
  // away without a click back into the input. Single-valued skips that: it already closes the panel
  // via state, and refocusing the input would only fire its onFocus (openPanel) and reopen it.
  const toggle = (candidate: NamedNode, checked: boolean) => {
    if (!isMultiValued) {
      setTerm(candidate);
      setSearch("");
      setIsOpen(false);
      return;
    }
    if (checked) shape.addObject(candidate);
    else shape.removeObject(candidate);
    searchRef.current?.focus();
  };

  return (
    <div
      ref={containerRef}
      className="st-subclass"
      onBlur={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget as Node | null)) {
          setSearch("");
          setIsOpen(false);
        }
      }}
    >
      <div className="st-subclass__chips">
        {chips.map((chip) => (
          <ValueChip
            key={chip.value}
            term={chip}
            label={
              chip.termType === "NamedNode"
                ? valueNodeLabel({
                    term: chip,
                    propertyShape: shape,
                    languages: [activeInterfaceLanguage],
                  }).value
                : chip.value
            }
            onRemove={() => {
              removeChip(chip);
              searchRef.current?.focus();
            }}
          />
        ))}
        <Localized id="autocomplete-search-placeholder" attrs={{ placeholder: true }}>
          <input
            ref={searchRef}
            type="text"
            className="st-subclass__input"
            placeholder="Search…"
            aria-labelledby={labelledBy}
            value={search}
            onFocus={openPanel}
            // A single-valued pick closes the panel without ever blurring this input (see
            // ClassHierarchyTree's row - its onMouseDown keeps focus right where it was) - so a
            // second click straight back into an already-focused input fires no further "focus"
            // event and would otherwise leave the panel stuck closed. onClick re-opens it
            // regardless of whether focus actually moved.
            onClick={openPanel}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                if (search) setSearch("");
                else searchRef.current?.blur();
              } else if (event.key === "Backspace" && search === "" && chips.length > 0) {
                removeChip(chips[chips.length - 1]);
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
                if (target && !isDisabled?.(target.term)) toggle(target.term, isMultiValued ? !isChecked(target.term) : true);
              }
            }}
          />
        </Localized>
      </div>

      {isOpen && (
        <div className="st-subclass__panel">
          <ClassHierarchyTree
            tree={filteredTree}
            query={query}
            inputType={inputType}
            groupName={groupName}
            isChecked={isChecked}
            isDisabled={isDisabled}
            activeTerm={activeTerm}
            rowRefs={rowRefs}
            onToggle={toggle}
          />
        </div>
      )}
    </div>
  );
}
