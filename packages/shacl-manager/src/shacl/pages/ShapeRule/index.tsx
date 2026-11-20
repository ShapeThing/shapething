import { useParams } from "react-router";

export function ShapeRule() {
  const { rule } = useParams();

  return (
    <div>
      <h4>Rule</h4>
      <p>{rule}</p>
    </div>
  );
}
