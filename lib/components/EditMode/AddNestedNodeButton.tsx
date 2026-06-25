import { Localized } from '@fluent/react'
import type { NamedNode, Term } from '@rdfjs/types'
import { ReactNode, useContext, useState } from 'react'
import { createPortal } from 'react-dom'
import { mainContext } from '../../core/main-context'
import ShaclRenderer from '../ShaclRenderer'

export default function AddNestedNodeButton({
  shapeIri,
  setTerm,
  children
}: {
  shapeIri: NamedNode
  setTerm?: (term: Term) => void
  children: (onClick: () => void) => ReactNode
}) {
  const { originalInput, data: dataset, jsonLdContext, update } = useContext(mainContext)
  const [open, setOpen] = useState(false)

  return (
    <>
      {children(() => setOpen(true))}
      {open
        ? createPortal(
            <dialog className="popup-editor" ref={element => element?.showModal()}>
              <ShaclRenderer
                key={shapeIri?.value}
                {...originalInput}
                prefixes={jsonLdContext.getContextRaw()}
                data={undefined}
                subject={undefined}
                enableSubjectEditor={true}
                shapeSubject={shapeIri}
                onSubmit={data => {
                  const { dataset: innerDataset, context } = data
                  for (const quad of [...innerDataset]) dataset.add(quad)
                  if (setTerm) setTerm(context.subject)
                  setOpen(false)
                  update()
                }}
              >
                {submit => {
                  return (
                    <>
                      <button onClick={submit} className="button primary">
                        <Localized id="save">Save</Localized>
                      </button>

                      <button className="secondary button outline" onClick={() => setOpen(false)}>
                        <Localized id="cancel">Cancel</Localized>
                      </button>
                    </>
                  )
                }}
              </ShaclRenderer>
            </dialog>,

            document.body
          )
        : null}
    </>
  )
}
