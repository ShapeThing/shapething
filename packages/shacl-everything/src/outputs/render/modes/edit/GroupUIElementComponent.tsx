import type { GroupUIElement } from "@/structure/GroupUIElement.ts";

export default function GroupUIElementComponent({ group }: { group: GroupUIElement }) {
  const entry = group.widget();
  if (!entry) return null;

  const Widget = entry.Component;
  return <Widget group={group} />;
}
