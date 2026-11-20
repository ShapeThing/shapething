import { ShaclRenderer } from "@shapething/shacl-renderer";
import { useDataModel } from "../data-model/dataModelContext.ts";
import { factory, type Resource } from "../data-model/rdf.ts";
import { EditButton } from "./edit/EditButton.tsx";
import { useOrigin } from "./paths.ts";
import { useRendererProps, type ShapeSource } from "./rendererProps.ts";
import { useTermParam } from "./useTermParam.ts";

// How a kind of node is shown, and how it is edited: the same shape with an edit-only layout on top.
export type MetaShapes = { view: ShapeSource; edit: ShapeSource };

export function metaShapes(view: string, editLayout: string, nodeShape: string): MetaShapes {
  const root = factory.namedNode(nodeShape);
  return {
    view: { shapesGraph: view, nodeShape: root },
    edit: { shapesGraph: `${view}\n${editLayout}`, nodeShape: root },
  };
}

type MetaViewProps = {
  term: Resource;
  shapes: MetaShapes;
  // Off for an overview that gathers what several nodes say about a class.
  editable?: boolean;
};

export function MetaView({ term, shapes, editable = true }: MetaViewProps) {
  const { store } = useDataModel();
  const origin = useOrigin();
  const rendererProps = useRendererProps(shapes.view);

  return (
    <div className="st-meta">
      {editable && origin === "managed" && (
        <div className="st-meta__actions">
          <EditButton term={term} {...shapes.edit} />
        </div>
      )}
      <ShaclRenderer
        {...rendererProps}
        mode="view"
        dataGraph={store}
        focusNode={term}
        viewModeLabelLayout="columns"
      />
    </div>
  );
}

// The page of the node a route parameter names.
export function MetaPage({ param, shapes }: { param: string; shapes: MetaShapes }) {
  const term = useTermParam(param);
  return term ? <MetaView term={term} shapes={shapes} /> : null;
}
