import { environmentContext } from "@/outputs/render/contexts/environmentContext.tsx";
import { useContext } from "react";

export const useEnvironment = () => {
  const context = useContext(environmentContext);
  if (!context) {
    throw new Error("useEnvironment must be used within an EnvironmentContextProvider");
  }
  return context;
};
