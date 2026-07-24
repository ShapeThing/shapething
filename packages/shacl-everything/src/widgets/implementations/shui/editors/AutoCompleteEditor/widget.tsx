import type { WidgetProps } from "@/widgets/types.ts";
import inputStyle from "@/theme/input.module.scss";

export default function AutoCompleteEditor({ shape, term }: WidgetProps) {
  return <input type="text" value={term.value} className={inputStyle.input} />;
}
