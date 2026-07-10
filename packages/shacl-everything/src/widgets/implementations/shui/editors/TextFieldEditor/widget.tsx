import { sh } from "@/helpers/namespaces.ts";
import type { ObjectWidgetProps } from "@/widgets/types.ts";

export default function TextFieldEditor({ node }: ObjectWidgetProps) {
  const pattern = node.getOne(sh("pattern"))?.value;
  const minLength = node.getOne(sh("minLength"))?.value;
  const maxLength = node.getOne(sh("maxLength"))?.value;

  return (
    <input
      type="text"
      pattern={pattern}
      minLength={minLength ? parseInt(minLength) : undefined}
      maxLength={maxLength ? parseInt(maxLength) : undefined}
    />
  );
}
