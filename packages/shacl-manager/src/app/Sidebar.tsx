import { owl, sh } from "@shapething/shacl-renderer";
import { Suspense, useDeferredValue, useEffect, useId, useState, type ReactNode } from "react";
import { useDataModel } from "../data-model/dataModelContext.ts";
import type { TreeNode } from "../data-model/tree.ts";
import { owlMeta } from "../owl/metaShapes.ts";
import { shaclMeta } from "../shacl/metaShapes.ts";
import { DataModelHeader } from "./DataModelPage.tsx";
import { CreateButton } from "./edit/CreateButton.tsx";
import { filterTree, useNavigation } from "./navigation/navigation.ts";
import { classPath, subjectPath } from "./paths.ts";
import { termTitle, useTermLabel } from "./termLabel.ts";
import { SidebarResizer } from "./SidebarResizer.tsx";
import { Tree } from "./Tree.tsx";

// What to show, each toggled on its own: knowledge (OWL classes) and shapes (SHACL shapes and
// groups), from the data model itself (managed) and from its imports.
type Toggles = { owl: boolean; shacl: boolean; managed: boolean; imported: boolean };
type Toggle = keyof Toggles;
type Chip = { value: Toggle; label: string; title: string };

// One row of chips for what something is, one for where it comes from.
const chipRows: { label: string; chips: Chip[] }[] = [
  {
    label: "Show",
    chips: [
      { value: "owl", label: "Knowledge", title: "Classes (OWL)" },
      { value: "shacl", label: "Shapes", title: "Shapes and property groups (SHACL)" },
    ],
  },
  {
    label: "From",
    chips: [
      { value: "managed", label: "Managed", title: "What the data model itself declares" },
      { value: "imported", label: "Imported", title: "What the imports declare" },
    ],
  },
];

const kindOf = (node: TreeNode): "owl" | "shacl" => (node.kind === "class" ? "owl" : "shacl");

// A class only a shape refers to isn't the data model's own, so it goes with the imports.
const matchesOrigin = (toggles: Toggles) => (node: TreeNode) =>
  node.origin === "managed" ? toggles.managed : toggles.imported;

const matchesKind = (toggles: Toggles) => (node: TreeNode) => toggles[kindOf(node)];

// A row with nothing on would show nothing at all, so it counts as all on: the tree shows that
// straight away, the chips follow after a moment.
function filled(toggles: Toggles): Toggles {
  const next = { ...toggles };
  for (const row of chipRows) {
    if (row.chips.some((chip) => next[chip.value])) continue;
    for (const chip of row.chips) next[chip.value] = true;
  }
  return next;
}

const fillDelay = 1000;

// One tree for classes and shapes, from the data model and its imports together. Where something
// comes from is a marker on its row and a filter, not a separate tab.
export function Sidebar() {
  const [toggles, setToggles] = useState<Toggles>({
    owl: true,
    shacl: true,
    managed: true,
    imported: false,
  });
  const toggle = (key: Toggle) => setToggles((current) => ({ ...current, [key]: !current[key] }));
  const empty = chipRows.some((row) => row.chips.every((chip) => !toggles[chip.value]));
  useEffect(() => {
    if (!empty) return;
    const timer = setTimeout(() => setToggles(filled), fillDelay);
    return () => clearTimeout(timer);
  }, [empty, toggles]);
  const [text, setText] = useState("");
  const query = useDeferredValue(text.trim().toLowerCase());

  return (
    <aside className="st-manager__sidebar">
      <DataModelHeader />
      <div className="st-manager__filter">
        <input
          type="search"
          className="st-manager__filter-input"
          placeholder="Filter classes and shapes"
          aria-label="Filter classes and shapes"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <Chips toggles={toggles} onToggle={toggle} />
      </div>
      <div className="st-manager__sidebar-content">
        <Suspense fallback={<p>Loading the data model…</p>}>
          <Sections toggles={filled(toggles)} query={query} />
        </Suspense>
      </div>
      <SidebarResizer />
    </aside>
  );
}

function Chips({ toggles, onToggle }: { toggles: Toggles; onToggle: (key: Toggle) => void }) {
  const id = useId();
  return (
    <div className="st-manager__filter-rows">
      {chipRows.map((row) => (
        <ChipRow
          key={row.label}
          id={`${id}-${row.label}`}
          row={row}
          toggles={toggles}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}

function ChipRow({
  id,
  row,
  toggles,
  onToggle,
}: {
  id: string;
  row: (typeof chipRows)[number];
  toggles: Toggles;
  onToggle: (key: Toggle) => void;
}) {
  return (
    <>
      <span id={id} className="st-manager__filter-label">
        {row.label}
      </span>
      <div className="st-manager__filter-chips" role="group" aria-labelledby={id}>
        {row.chips.map((chip) => (
          <button
            key={chip.value}
            type="button"
            title={chip.title}
            aria-pressed={toggles[chip.value]}
            onClick={() => onToggle(chip.value)}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </>
  );
}

// The node's page, in the origin it is declared in. A class only a shape refers to has no page of
// its own in either; it opens with what the imports say about it.
const linkTo = (segment: string, node: TreeNode) => {
  const origin = node.origin ?? "imported";
  if (node.kind === "class") return classPath(origin, segment);
  return subjectPath(origin, node.kind ?? "shape", segment);
};

function Sections({ toggles, query }: { toggles: Toggles; query: string }) {
  const navigation = useNavigation();
  const dataModel = useDataModel();
  const termLabel = useTermLabel();

  const matches = (node: TreeNode) =>
    matchesOrigin(toggles)(node) &&
    matchesKind(toggles)(node) &&
    (!query ||
      termLabel(node.term).toLowerCase().includes(query) ||
      termTitle(node.term, dataModel).toLowerCase().includes(query));
  const filtering = Object.values(toggles).some((on) => !on) || !!query;
  const filter = (nodes: TreeNode[]) => (filtering ? filterTree(nodes, matches) : nodes);

  const classes = filter(navigation.classes);
  const shapesWithoutClass = filter(navigation.shapesWithoutClass);
  const groups = filter(navigation.groups);
  const anonymousClasses = filter(navigation.anonymousClasses);
  const empty = [classes, shapesWithoutClass, groups, anonymousClasses].every(
    (nodes) => nodes.length === 0,
  );

  return (
    <>
      <section>
        <header className="st-manager__section-header">
          <h3>
            {toggles.owl && !toggles.shacl
              ? "Classes"
              : toggles.shacl && !toggles.owl
                ? "Shapes"
                : "Classes and shapes"}
          </h3>
          <div className="st-manager__section-actions">
            {toggles.owl && (
              <CreateButton
                {...owlMeta.class.edit}
                label="class"
                kind="class"
                type={owl("Class")}
                path="/knowledge/managed/new"
                back="/knowledge/managed"
                to={(segment) => classPath("managed", segment)}
              />
            )}
            {toggles.shacl && (
              <CreateButton
                {...shaclMeta.shape.edit}
                label="shape"
                kind="shape"
                type={sh("NodeShape")}
                path="/shapes/managed/new/shape"
                back="/shapes/managed"
                to={(segment) => subjectPath("managed", "shape", segment)}
              />
            )}
          </div>
        </header>
        {empty && filtering ? (
          <p>Nothing matches the filter.</p>
        ) : classes.length ? (
          <Tree nodes={classes} linkTo={linkTo} />
        ) : (
          !filtering && <p>No classes yet.</p>
        )}
      </section>
      <Section title="Shapes without a class" nodes={shapesWithoutClass} filtering={filtering} />
      <Section
        title="Property groups"
        nodes={groups}
        filtering={filtering}
        action={
          <CreateButton
            {...shaclMeta.shape.edit}
            label="group"
            kind="group"
            type={sh("PropertyGroup")}
            path="/shapes/managed/new/group"
            back="/shapes/managed"
            to={(segment) => subjectPath("managed", "group", segment)}
          />
        }
      />
      <Section title="Anonymous classes" nodes={anonymousClasses} filtering={filtering} />
    </>
  );
}

const hasManaged = (nodes: TreeNode[]): boolean =>
  nodes.some((node) => node.origin === "managed" || hasManaged(node.children));

// A secondary section: collapsed, unless the data model has something of its own in it or a
// filter is on. Without anything to show and nothing to create, it is left out.
function Section({
  title,
  nodes,
  filtering,
  action,
}: {
  title: string;
  nodes: TreeNode[];
  filtering: boolean;
  action?: ReactNode;
}) {
  if (!nodes.length && (filtering || !action)) return null;
  const open = filtering || hasManaged(nodes);

  return (
    <section>
      {/* Remounted when the filter turns on or off, so it opens and closes with it. */}
      <details key={String(open)} open={open} className="st-manager__collapsible">
        <summary className="st-manager__section-header">
          <h3>
            {title} <span className="st-manager__section-count">{nodes.length}</span>
          </h3>
          {action}
        </summary>
        <Tree nodes={nodes} linkTo={linkTo} />
      </details>
    </section>
  );
}
