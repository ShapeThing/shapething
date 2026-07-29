import "./style.css";

type Props = {
  label?: string;
  severity?: string;
  description?: string;
  children?: React.ReactNode;
};

export default function FormElement({ label, severity, description, children }: Props) {
  return (
    <div className="st-form-element" data-severity={severity}>
      {label && <label className="st-form-element__label">{label}</label>}
      {description && <p className="st-form-element__description">{description}</p>}
      {children}
    </div>
  );
}
