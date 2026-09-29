import ContentLanguageSwitcher from "@/outputs/render/components/ContentLanguageSwitcher/index.tsx";
import InterfaceLanguageSwitcher from "@/outputs/render/components/InterfaceLanguageSwitcher/index.tsx";
import Title from "@/outputs/render/components/Title/index.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import NodeUIComponent from "@/outputs/render/modes/view/NodeUIComponent.tsx";
import "./style.css";

type Props = {
  children?: React.ReactNode;
};

export default function ViewModeWrapper({ children }: Props) {
  const { enableTitle, nodeShapes, focusNode } = useEnvironment();
  return (
    <div className="st-view-mode">
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
