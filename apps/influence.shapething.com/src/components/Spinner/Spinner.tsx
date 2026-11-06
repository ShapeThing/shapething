import { clsx } from "../../clsx.ts";
import "./style.scss";

export default function Spinner({
  label = "Loading",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span className={clsx("spinner", className)} role="status">
      <img src="/loading.svg" alt="" />
      <span className="visually-hidden">{label}</span>
    </span>
  );
}
