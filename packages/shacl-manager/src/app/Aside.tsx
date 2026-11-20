import { Suspense } from "react";
import { termKey } from "../data-model/rdf.ts";
import { RelatedShapes } from "../shacl/RelatedShapes.tsx";
import { useSubject } from "../shacl/useSubject.ts";
import { useOrigin } from "./paths.ts";

// The right-hand column of a class or shape page; the layout's grid only makes room for it then.
export function Aside() {
  const subject = useSubject();
  const origin = useOrigin();
  if (!subject || subject.kind === "group") return null;

  return (
    <aside className="st-manager__aside">
      <section>
        <h3>Related shapes</h3>
        <Suspense
          key={`${origin} ${subject.kind} ${termKey(subject.term)}`}
          fallback="Loading related shapes…"
        >
          <RelatedShapes subject={subject} origin={origin} />
        </Suspense>
      </section>
    </aside>
  );
}
