import { useContext } from "react";
import { validationContext } from "@/outputs/render/contexts/validationContext.tsx";

export const useValidation = () => {
  const context = useContext(validationContext);
  if (!context) {
    throw new Error("useValidation must be used within a ValidationContextProvider");
  }
  return context;
};
