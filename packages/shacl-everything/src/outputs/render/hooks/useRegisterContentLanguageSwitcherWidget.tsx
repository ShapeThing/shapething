import { useEffect } from "react";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";

// Call with whether the caller's own resolved widget needs the active content language (see
// WidgetMeta.needsLanguageSwitcher) - lets ContentLanguageSwitcher hide itself when nothing in the
// current form would actually respond to it. Registration is keyed to the property itself, not to
// a specific value's widget instance, so it stays stable across a value's own async default-term
// resolution (see useDefaultObject) instead of flickering the switcher on and off.
export const useRegisterContentLanguageSwitcherWidget = (needsSwitcher: boolean) => {
  const { registerLanguageSwitcherWidget } = useContentLanguage();
  useEffect(() => {
    if (!needsSwitcher) return;
    return registerLanguageSwitcherWidget();
  }, [needsSwitcher, registerLanguageSwitcherWidget]);
};
