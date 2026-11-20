import { useParams } from "react-router";
import { useSubject } from "../../useSubject.ts";

export function ShapeProperty() {
  const subject = useSubject();
  const { property } = useParams();

  return (
    <div>
      <h3>Property</h3>
      <p>
        {subject?.kind} &lt;{subject?.term.value}&gt; / {property}
      </p>
    </div>
  );
}
