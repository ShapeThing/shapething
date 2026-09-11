import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Localized } from "@fluent/react";
import type { NamedNode, Term } from "@rdfjs/types";
import { sh } from "@/helpers/namespaces.ts";
import { valueNodeLabel } from "@/resolution/label.ts";
import ClassHierarchyTree from "@/outputs/render/components/ClassHierarchyTree/index.tsx";
import ValueChip from "@/outputs/render/components/ValueChip/index.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import {
  buildClassHierarchy,
  filterClassTree,
  flattenVisibleClassNodes,
  rollUpClassCounts,
} from "@/structure/classHierarchy.ts";
import type { FacetWidgetProps } from "@/widgets/types.ts";
import "./style.css";

/**
 * Filters by a class drawn from a `shui:rootClass` taxonomy (rdfs:subClassOf hierarchy over
 * shapesGraph) - the facet-mode counterpart of shui:SubClassEditor, sharing its rootClass/
 * subClassOf tree (structure/classHierarchy.ts, outputs/render/components/ClassHierarchyTree) and
 * its whole chips+search-input combobox shape, since a flat always-expanded tree doesn't scale to
 * a taxonomy of any real size. Writes sh:in the same way CategoryFacet does - an ordinary
 * exact-match constraint - via `selected`/`setConstraint` in place of the editor's single term/
 * setTerm pair, since a facet has no single current value and no dataGraph object set of its own
 * to own; any node in the tree (not just leaves) is independently selectable.
 *
 * `sh:maxCount 1` renders as single-select (radio buttons sharing one native group, picking a new
 * node anywhere in the tree deselects whichever was picked before and closes the panel, same as
 * the editor's own single-valued case); every other cardinality renders multi-select checkboxes
 * that leave the panel open for further picks, refocusing the search input after each one.
 */
export default function SubClassFacet({
  shape,
  getConstraint,
  setConstraint,
  valueCounts,
  labelledBy,
}: FacetWidgetProps) {
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const rootClass = shape.get(sh("rootClass"))[0];
  const singleSelect = shape.get(sh("maxCount")) === 1;
  const inputType: "checkbox" | "radio" = singleSelect ? "radio" : "checkbox";
  const selected = getConstraint(sh("in"));
  const groupName = useId();
  const chips: Term[] = selected;
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

  // valueCounts (see FacetWidgetProps) is only ever an exact-match tally - rolled up here through
  // the same tree so a non-leaf node's count reflects everything filed under it too, not just what
  // happens to be tagged with that exact class (see rollUpClassCounts's own doc comment).
  const rolledUpValueCounts = useMemo(
    () => (valueCounts && tree ? rollUpClassCounts(tree, valueCounts) : valueCounts),
    [valueCounts, tree],
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

  // Jumps the (possibly long) tree to whatever's currently highlighted - including the property's
  // existing constraint the moment the tree opens (see openPanel), so a value nested deep in the
  // hierarchy doesn't open scrolled to the top with no indication of where it actually is.
  useEffect(() => {
    if (isOpen && activeTerm) {
      rowRefs.current.get(activeTerm)?.scrollIntoView({ block: "nearest" });
    }
  }, [isOpen, activeTerm]);

  const isChecked = (candidate: NamedNode): boolean =>
    selected.some((term) => term.equals(candidate));

  const openPanel = () => {
    const anchor = selected[0]?.value;
    setActiveIndex(visibleItems.findIndex((item) => item.term.value === anchor));
    setIsOpen(true);
  };

  const removeChip = (chip: Term) => {
    const next = selected.filter((term) => !term.equals(chip));
    setConstraint(sh("in"), next.length > 0 ? next : undefined);
  };

  // Single-select: picking a class replaces the whole sh:in constraint and closes the panel, same
  // as the editor's own single-valued case. Multi-select: toggling a box adds/removes right away
  // and leaves the panel open for further picks - refocusing the search input afterwards (same as
  // removeChip below) undoes the browser's own focus move onto the checkbox that was just clicked,
  // so typing continues right away without a click back into the input.
  const toggle = (candidate: NamedNode, checked: boolean) => {
    if (singleSelect) {
      setConstraint(sh("in"), checked ? [candidate] : undefined);
      setSearch("");
      setIsOpen(false);
      return;
    }
    const next = checked
      ? [...selected, candidate]
      : selected.filter((term) => !term.equals(candidate));
    setConstraint(sh("in"), next.length > 0 ? next : undefined);
    searchRef.current?.focus();
  };

  return (
    <div
      ref={containerRef}
      className="st-subclass-facet"
      onBlur={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget as Node | null)) {
          setSearch("");
          setIsOpen(false);
        }
      }}
    >
      <div className="st-subclass-facet__chips">
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
            className="st-subclass-facet__input"
            placeholder="Search…"
            aria-labelledby={labelledBy}
            value={search}
            onFocus={openPanel}
            // A single-select pick closes the panel without ever blurring this input (see
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
                if (target) toggle(target.term, singleSelect ? true : !isChecked(target.term));
              }
            }}
          />
        </Localized>
      </div>

      {isOpen && (
        <div className="st-subclass-facet__panel">
          <ClassHierarchyTree
            tree={filteredTree}
            query={query}
            inputType={inputType}
            groupName={groupName}
            isChecked={isChecked}
            activeTerm={activeTerm}
            rowRefs={rowRefs}
            valueCounts={rolledUpValueCounts}
            onToggle={toggle}
          />
        </div>
      )}
    </div>
  );
}
