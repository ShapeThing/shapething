import type { Environment } from "@/environment.ts";
import EnvironmentContextProvider from "@/outputs/render/contexts/EnvironmentContextProvider.tsx";
import { environmentContext } from "@/outputs/render/contexts/environmentContext.tsx";
import { lazy, useContext } from "react";

export type ShaclRendererProps = Partial<Environment>;

export default function ShaclRenderer(inputProps: ShaclRendererProps) {
  return (
    <EnvironmentContextProvider {...inputProps}>
      <ShaclRendererInner />
    </EnvironmentContextProvider>
  );
}

const modesNodeUIComponents: Record<Environment["mode"], React.ComponentType> = {
  edit: lazy(() => import("@/outputs/render/modes/edit/NodeUIComponent.tsx")),
  view: lazy(() => import("@/outputs/render/modes/view/NodeUIComponent.tsx")),
  facet: lazy(() => import("@/outputs/render/modes/facet/NodeUIComponent.tsx")),
};

function ShaclRendererInner() {
  const { mode } = useContext(environmentContext);
  const NodeUIComponent = modesNodeUIComponents[mode];
  return (
    <div>
      test
      <NodeUIComponent />
    </div>
  );
}
