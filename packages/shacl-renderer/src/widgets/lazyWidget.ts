import { createElement, lazy, useState, type ComponentType } from "react";

type Preloadable = { preload: () => Promise<unknown> };

/**
 * A widget component whose code is only loaded once a form actually needs it - and loaded
 * *ahead* of rendering: widget resolution (see useWidget.tsx's widgetQueryOptions) calls
 * `preload()` as soon as scoring has picked the widget, and only resolves once its code is in. Each
 * value's widget download therefore runs in parallel with the other values' scoring, and by the
 * time the slot renders the component is already there - no Suspense fallback, no layout flash.
 *
 * Rendered before its code is in (e.g. a widget switched to through the alternatives menu), it
 * falls back to React.lazy, suspending into the nearest boundary like any lazy component. Which of
 * the two an instance renders is fixed when it mounts, so the code arriving later never swaps the
 * element type underneath a mounted widget (which would remount it and lose its state).
 */
export function lazyWidget<Props extends object>(
  load: () => Promise<{ default: ComponentType<Props> }>,
): ComponentType<Props> & Preloadable {
  let loaded: ComponentType<Props> | undefined;
  let loading: Promise<ComponentType<Props>> | undefined;
  const preload = () => (loading ??= load().then((module) => (loaded = module.default)));
  const Lazy = lazy(() => preload().then((Component) => ({ default: Component })));

  function LazyWidget(props: Props) {
    const [Component] = useState<ComponentType<Props>>(() => loaded ?? Lazy);
    return createElement(Component, props);
  }
  return Object.assign(LazyWidget, { preload });
}

/** Loads a lazyWidget's code ahead of rendering it - a no-op for any other (eager) component. */
export function preloadWidget(component: unknown): Promise<unknown> | undefined {
  const preload = (component as Partial<Preloadable> | undefined)?.preload;
  return typeof preload === "function" ? preload() : undefined;
}
