import { Component, type ReactNode } from "react";

type Props = { children: ReactNode; fallback: (error: unknown) => ReactNode };

// React only catches render errors (such as a data model that fails to load) in a class component.
export class ErrorBoundary extends Component<Props, { error?: unknown }> {
  state: { error?: unknown } = {};

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  render() {
    return "error" in this.state && this.state.error !== undefined
      ? this.props.fallback(this.state.error)
      : this.props.children;
  }
}
