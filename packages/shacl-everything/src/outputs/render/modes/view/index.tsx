import ContentLanguageSwitcher from "@/outputs/render/components/ContentLanguageSwitcher/index.tsx";
import InterfaceLanguageSwitcher from "@/outputs/render/components/InterfaceLanguageSwitcher/index.tsx";
import NodeUIComponent from "@/outputs/render/modes/view/NodeUIComponent.tsx";
import "./style.css";

type Props = {
  children?: React.ReactNode;
};

export default function ViewModeWrapper({ children }: Props) {
  return (
    <div className="st-view-mode">
      <header className="st-header">
        <InterfaceLanguageSwitcher />
        <ContentLanguageSwitcher />
      </header>
      <NodeUIComponent />
      {children}
    </div>
  );
}
