import { Suspense } from "react";
import { useMatch } from "react-router";
import { RelatedShapes } from "../shacl/related/RelatedShapes.tsx";
import type { Origin } from "../shacl/useShapeTree.ts";
import { type Subject, useSubject } from "../shacl/useSubject.ts";

// The right-hand column of a class or shape page. Not rendered elsewhere; the layout's grid
// only makes room for it when it is there (see layout.css).
export function Aside() {
  const subject = useSubject();
  if (!subject) return null;
  return <AsideContent subject={subject} />;
}

function AsideContent({ subject }: { subject: Subject }) {
  const origin = (useMatch("/shapes/:origin/*")?.params.origin ?? "managed") as Origin;
  const key = `${origin} ${subject.kind} ${subject.term.termType} ${subject.term.value}`;

  return (
    <aside className="st-manager__aside">
      <section>
        <h3>Related shapes</h3>
        {/* Keyed by the subject, so the previous subject's list never shows while loading. */}
        <Suspense key={key} fallback="Loading related shapes…">
          <RelatedShapes subject={subject} origin={origin} />
        </Suspense>
      </section>
    </aside>
  );
}
