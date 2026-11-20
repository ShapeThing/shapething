import { useParams } from "react-router";

export function ShapeQuery() {
  const { constraint } = useParams();

  return (
    <div>
      <h4>Query</h4>
      <p>{constraint}</p>
    </div>
  );
}
