import { useT } from "@/app/useT.ts";
import { useLabels } from "@/data-model/useLabels.ts";
import type { NodeShape, PropertyShape, TargetingGroups as Groups } from "@/shapes/model.ts";
import ShapeChip from "@/views/ShapeChip.tsx";

const sections = [
  { kind: "node", id: "shacl-manager-targeting-node", fallback: "Node targets (sh:targetNode)" },
  {
    kind: "subjectsOf",
    id: "shacl-manager-targeting-subjects-of",
    fallback: "Subjects of (sh:targetSubjectsOf)",
  },
  {
    kind: "objectsOf",
    id: "shacl-manager-targeting-objects-of",
    fallback: "Objects of (sh:targetObjectsOf)",
  },
  { kind: "none", id: "shacl-manager-targeting-none", fallback: "Untargeted (used via sh:node)" },
] as const;

export default function TargetingGroups({
  groups,
  propertyShapes,
  showShape = () => true,
}: {
  groups: Groups;
  propertyShapes: Map<string, PropertyShape[]>;
  showShape?: (shape: NodeShape) => boolean;
}) {
  const t = useT();
  const visible = Object.fromEntries(
    Object.entries(groups).map(([kind, shapes]) => [kind, shapes.filter(showShape)]),
  ) as Groups;
  return (
    <div className="st-manager-groups">
      {sections.map(({ kind, id, fallback }) => (
        <details key={kind} open={visible[kind].length > 0 && visible[kind].length <= 8}>
          <summary>
            {t(id, null, fallback)} <span className="st-manager-count">{visible[kind].length}</span>
          </summary>
          <ul className="st-manager-list">
            {visible[kind].map((shape) => (
              <li key={shape.key}>
                <ShapeChip shape={shape} count={propertyShapes.get(shape.key)?.length ?? 0} />
                <Targets shape={shape} kind={kind} />
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}

function Targets({ shape, kind }: { shape: NodeShape; kind: string }) {
  const labels = useLabels();
  const targets = shape.targets.filter((t) => t.kind === kind);
  if (targets.length === 0) return null;
  return (
    <span className="st-manager-muted">
      {" → "}
      {targets.map((t) => labels.display(t.target)).join(", ")}
    </span>
  );
}
