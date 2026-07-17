import style from "./style.module.css";

type Props = {
  label?: string;
  severity?: string;
  children?: React.ReactNode;
};

export default function FormElement({ label, severity, children }: Props) {
  return (
    <div className={style["form-element"]} data-severity={severity}>
      {label && <label className={style.label}>{label}</label>}
      {children}
    </div>
  );
}
