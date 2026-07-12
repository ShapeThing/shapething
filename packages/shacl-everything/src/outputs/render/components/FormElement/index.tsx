type Props = {
  label?: string;
  severity?: string;
  children?: React.ReactNode;
};

export default function FormElement({ label, severity, children }: Props) {
  return (
    <div className="form-element" data-severity={severity}>
      {label && <label className="label">{label}</label>}
      {children}
    </div>
  );
}
