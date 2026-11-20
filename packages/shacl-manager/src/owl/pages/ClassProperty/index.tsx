import { useParams } from "react-router";

export function ClassProperty() {
  const { class: classParam, property } = useParams();

  return (
    <div>
      <h3>Class property</h3>
      <p>
        {classParam} / {property}
      </p>
    </div>
  );
}
