import { Icon } from "@iconify/react/offline";
import type { ReactNode } from "react";
import { caretIcon } from "../helpers/icons";

export function AccordionHeading({ children }: { children?: ReactNode }) {
  return (
    <>
      <Icon icon={caretIcon} className="icon" />
      {children}
    </>
  );
}
