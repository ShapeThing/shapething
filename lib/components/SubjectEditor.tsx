import { Localized } from '@fluent/react'
import factory from '@rdfjs/data-model'
import type { Quad_Subject } from '@rdfjs/types'
import { useContext } from 'react'
import { mainContext } from '../core/main-context'
import { sh } from '../core/namespaces'
import URIEditor from '../widgets/editors/URIEditor'
import PropertyElement from './PropertyElement'

export default function SubjectEditor() {
  const context = useContext(mainContext)
  const { shapePointer, mode, dataPointer, subjectEditLocalNameOnly, enableSubjectEditor, subject, renameSubject } =
    context
  if (mode !== 'edit') return null
  const nodeKind = shapePointer.out(sh('nodeKind')).term ?? sh('BlankNode')

  const description = subjectEditLocalNameOnly ? (
    <Localized id="subject-editor-description-local">The name of this resource</Localized>
  ) : (
    <Localized id="subject-editor-description">The IRI of this resource</Localized>
  )

  if (!enableSubjectEditor) return null

  return nodeKind.equals(sh('IRI')) || dataPointer.term.termType === 'NamedNode' ? (
    <PropertyElement
      description={description}
      cssClass="subject-editor"
      required
      label={<Localized id="subject">Subject</Localized>}
    >
      <div className="editors">
        <div className="editor">
          {/* @ts-expect-error We only want to use half of the interface of URIEditor */}
          <URIEditor
            term={
              dataPointer.term.value === 'urn:no-subject-given'
                ? factory.namedNode('')
                : (dataPointer.term as Quad_Subject)
            }
            setTerm={newSubject => {
              if (subject.equals(newSubject)) return
              renameSubject(newSubject as Quad_Subject)
            }}
          />
        </div>
      </div>
    </PropertyElement>
  ) : null
}
