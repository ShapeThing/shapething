type Props = {
  label?: string;
  children?: React.ReactNode;
};

export default function FormElement({ label, children }: Props) {
  return (
    <div className="form-element">
      {label && <label className="label">{label}</label>}
      {children}
    </div>
  );
}
