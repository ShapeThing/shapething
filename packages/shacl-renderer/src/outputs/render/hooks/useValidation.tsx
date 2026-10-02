import { useContext, useSyncExternalStore } from "react";
import {
  validationContext,
  type ValidationStore,
} from "@/outputs/render/contexts/validationContext.tsx";

export const useValidationStore = (): ValidationStore => {
  const store = useContext(validationContext);
  if (!store) {
    throw new Error("useValidation must be used within a ValidationContextProvider");
  }
  return store;
};

/**
 * The whole current result list - re-renders on every validation run. Prefer
 * usePropertyValidationResults for anything per-property, which only re-renders when its own
 * slice changes.
 */
export const useValidation = () => {
  const store = useValidationStore();
  const { index, isValidating } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return { results: index.results, isValidating };
};
