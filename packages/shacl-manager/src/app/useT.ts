import { useLocalization } from "@fluent/react";
import type { FluentVariable } from "@fluent/bundle";

/** `t("id", { name })` with the English string as the last-resort fallback. */
export function useT() {
  const { l10n } = useLocalization();
  return (id: string, args?: Record<string, FluentVariable> | null, fallback?: string) =>
    l10n.getString(id, args, fallback);
}
