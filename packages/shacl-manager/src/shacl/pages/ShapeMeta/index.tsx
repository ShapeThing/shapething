import { useSubject } from "../../useSubject.ts";

export function ShapeMeta() {
  const subject = useSubject();

  return (
    <div>
      <h3>Meta</h3>
      <p>
        {subject?.kind} &lt;{subject?.term.value}&gt;
      </p>
    </div>
  );
}
