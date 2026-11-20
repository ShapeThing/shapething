import { useParams } from "react-router";

export function ClassMeta() {
  const { class: classParam } = useParams();

  return (
    <div>
      <h3>Class meta</h3>
      <p>{classParam}</p>
    </div>
  );
}
