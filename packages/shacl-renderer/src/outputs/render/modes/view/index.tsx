import { clsx } from "clsx";
import type { ModeProps } from "@/outputs/render/render.tsx";
import ContentLanguageSwitcher from "@/outputs/render/components/ContentLanguageSwitcher/index.tsx";
import InterfaceLanguageSwitcher from "@/outputs/render/components/InterfaceLanguageSwitcher/index.tsx";
import Title from "@/outputs/render/components/Title/index.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import NodeUIComponent from "@/outputs/render/modes/view/NodeUIComponent.tsx";
import "./style.css";

type Props = ModeProps & {
  children?: React.ReactNode;
};

export default function ViewModeWrapper({ children, className }: Props) {
  const { enableTitle, nodeShapes, focusNode } = useEnvironment();
  return (
    <div className={clsx("st-view-mode", className)}>
      <header className="st-header">
        <InterfaceLanguageSwitcher />
        <ContentLanguageSwitcher />
      </header>
      {enableTitle && <Title action="view" nodeShapes={nodeShapes} focusNode={focusNode} />}
      <NodeUIComponent noWrapper />
      {children}
    </div>
  );
}
