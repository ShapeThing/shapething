import { useCallback, useMemo, useState, type ReactNode } from "react";
import { contentLanguageContext } from "@/outputs/render/contexts/contentLanguageContext.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { primarySubtag } from "@/helpers/bestByLanguage.ts";
import type { BCP47 } from "@/types/BCP47.ts";

// The initially active content language: an exact match for Environment.contentLanguage among
// the available languages, falling back to a shared primary subtag (e.g. "nl" -> "nl-NL"), then
// to whatever language happens to be first, then - only when nothing is available at all - to
// contentLanguage itself, so there is always a valid BCP47 value to start from.
function initialActiveLanguage(languages: BCP47[], contentLanguage: BCP47): BCP47 {
  if (languages.length === 0) return contentLanguage;

  const exact = languages.find(
    (language) => language.toLowerCase() === contentLanguage.toLowerCase(),
  );
  if (exact) return exact;

  const primary = primarySubtag(contentLanguage);
  const bySubtag = languages.find((language) => primarySubtag(language) === primary);
  if (bySubtag) return bySubtag;

  return languages[0];
}

export default function ContentLanguageProvider({ children }: { children: ReactNode }) {
  const { contentLanguages: initialLanguages, contentLanguage } = useEnvironment();
  const [activeLanguage, setActiveLanguage] = useState<BCP47>(() =>
    initialActiveLanguage(initialLanguages, contentLanguage),
  );
  // Environment.contentLanguages is fixed for the instance's lifetime (it's derived once by the
  // preprocessor chain - see preprocess/languages.ts), so runtime additions from
  // enableContentLanguageCreation live in local state here rather than trying to mutate it.
  const [languages, setLanguages] = useState<BCP47[]>(initialLanguages);

  const addLanguage = useCallback((language: BCP47) => {
    setLanguages((current) => (current.includes(language) ? current : [...current, language]));
    setActiveLanguage(language);
  }, []);

  const removeLanguage = useCallback(
    (language: BCP47) => {
      const remaining = languages.filter((candidate) => candidate !== language);
      setLanguages(remaining);
      // Only touches activeLanguage if it was the one just removed - otherwise whatever's
      // currently active stays active regardless of what else changed in the list.
      if (activeLanguage === language) setActiveLanguage(remaining[0] ?? language);
    },
    [languages, activeLanguage],
  );

  // Ref-counted rather than a Set of ids - callers don't have a stable identity to key by, and
  // "how many" is all ContentLanguageSwitcher needs (see hasLanguageSwitcherWidget below).
  const [languageSwitcherWidgetCount, setLanguageSwitcherWidgetCount] = useState(0);
  const registerLanguageSwitcherWidget = useCallback(() => {
    setLanguageSwitcherWidgetCount((count) => count + 1);
    return () => setLanguageSwitcherWidgetCount((count) => count - 1);
  }, []);

  // Memoized on the boolean, not the count: every widget registering itself (one effect per
  // property that needs the switcher, landing in batches as widget queries resolve) changes the
  // count, and a fresh value object each time re-rendered every useContentLanguage() consumer in
  // the form.
  const hasLanguageSwitcherWidget = languageSwitcherWidgetCount > 0;
  const value = useMemo(
    () => ({
      activeLanguage,
      setActiveLanguage,
      languages,
      addLanguage,
      removeLanguage,
      registerLanguageSwitcherWidget,
      hasLanguageSwitcherWidget,
    }),
    [
      activeLanguage,
      languages,
      addLanguage,
      removeLanguage,
      registerLanguageSwitcherWidget,
      hasLanguageSwitcherWidget,
    ],
  );

  return (
    <contentLanguageContext.Provider value={value}>{children}</contentLanguageContext.Provider>
  );
}
