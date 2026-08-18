import { createContext } from "react";
import type { BCP47 } from "@/types/BCP47.ts";

export type ContentLanguageContextValue = {
  activeLanguage: BCP47;
  setActiveLanguage: (language: BCP47) => void;
  // Content languages available to switch to. Seeded from Environment.languages, but grows at
  // runtime when enableContentLanguageCreation lets a user add a brand new one (see
  // ContentLanguageProvider) - Environment.languages itself stays fixed for the instance's
  // lifetime, so anything that can grow lives here instead.
  languages: BCP47[];
  // Adds `language` to `languages` (a no-op if already present) and makes it the active one.
  addLanguage: (language: BCP47) => void;
  // Drops `language` from `languages` (e.g. after ContentLanguageSwitcher's delete action wipes
  // every value in it - see deleteLiteralsByLanguage) - if it was the active language, falls back
  // to whatever's left, or leaves it as-is if that was the last one.
  removeLanguage: (language: BCP47) => void;
};

export const contentLanguageContext = createContext<ContentLanguageContextValue | undefined>(
  undefined,
);
