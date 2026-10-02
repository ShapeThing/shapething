import { useContext } from "react";
import { submitAttemptContext } from "@/outputs/render/contexts/submitAttemptContext.tsx";

export const useSubmitAttempt = () => {
  const context = useContext(submitAttemptContext);
  if (!context) {
    throw new Error("useSubmitAttempt must be used within an EditModeWrapper");
  }
  return context;
};
