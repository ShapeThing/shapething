import type { ComponentType } from "react";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

export type ObjectWidgetProps = {
  node: PropertyUIElement;
};

export type ObjectWidgetComponent = ComponentType<ObjectWidgetProps>;
