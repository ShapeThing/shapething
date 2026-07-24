import style from "./style.module.scss";

type Props = {
  label?: string;
  severity?: string;
  description?: string;
  children?: React.ReactNode;
};

export default function FormElement({ label, severity, description, children }: Props) {
  return (
    <div className={style["form-element"]} data-severity={severity}>
      {label && <label className={style.label}>{label}</label>}
      {description && <p className={style.description}>{description}</p>}
      {children}
    </div>
  );
}
