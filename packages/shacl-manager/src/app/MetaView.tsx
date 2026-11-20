import { ShaclRenderer } from "@shapething/shacl-renderer";
import type { ReactNode } from "react";
import { useDataModel } from "../data-model/dataModelContext.ts";
import { factory, type Resource } from "../data-model/rdf.ts";
import { type HeadingActions, type HeadingFallbacks, SubjectHeading } from "./SubjectHeading.tsx";
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
  // What the heading offers besides editing through `shapes`, see HeadingActions.
  actions?: HeadingActions;
  // Shown in an actions row above the view.
  children?: ReactNode;
  // A heading above the view, for a page the section's own heading doesn't already name. Without
  // it the section's heading holds the actions.
  heading?: boolean | HeadingFallbacks;
};

export function MetaView({ term, shapes, actions, children, heading }: MetaViewProps) {
  const { store } = useDataModel();
  const rendererProps = useRendererProps(shapes.view);

  return (
    <div className="st-meta">
      {heading && (
        <SubjectHeading
          term={term}
          fallbacks={heading === true ? {} : heading}
          actions={{ edit: { shapes: shapes.edit }, ...actions }}
        />
      )}
      {children && <div className="st-meta__actions">{children}</div>}
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

// The page of the node a route parameter names, e.g. a list item's.
export function MetaPage({ param, ...props }: { param: string } & Omit<MetaViewProps, "term">) {
  const term = useTermParam(param);
  return term ? <MetaView term={term} {...props} /> : null;
}
