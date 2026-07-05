import { Localized } from '@fluent/react'
import factory from '@rdfjs/data-model'
import { groupBy } from 'lodash-es'
import { Dispatch, SetStateAction, useContext, useMemo } from 'react'
import { getAllShapes, getFocusNodes } from '../../core/getFocusNodes'
import { languageContext } from '../../core/language-context'
import { initContext, MainContext, mainContext, NO_SUBJECT_GIVEN } from '../../core/main-context'
import { rdf, rdfs, schema, sh, stsr } from '../../core/namespaces'
import Grapoi from '../../Grapoi'
import { language } from '../../helpers/language'

type Action = {
  type: 'create-type' | 'edit'
  shape?: Grapoi
  data?: Grapoi
}

const actionId = (action: Action) => `${action.type}||${action.shape?.term?.value}||${action.data?.term?.value}`

const getLabel = (pointer?: Grapoi, activeInterfaceLanguage?: string): string => {
  if (!pointer) return ''

  const label = pointer
    ?.out([sh('name'), rdfs('label'), schema('name')])
    .best(language([activeInterfaceLanguage, '', '*']))?.value
  if (label) return label
  return pointer.term?.value?.split(/\/|#/g).pop() ?? ''
}

export default function ActionPicker({ setContext }: { setContext: Dispatch<SetStateAction<Promise<MainContext>>> }) {
  const { activeInterfaceLanguage } = useContext(languageContext)
  const context = useContext(mainContext)
  const { dataPointer, shapesPointer, originalInput, enableActionPicker, shapeSubject } = context

  if (!enableActionPicker) return null

  const allShapes = getAllShapes(shapesPointer)

  const mainShapes = allShapes.filter(shape => !shape.hasOut(rdf('type'), stsr('SubShape')).term)
  const subShapes = allShapes.filter(shape => !!shape.hasOut(rdf('type'), stsr('SubShape')).term)

  const focusNodeMatches = getFocusNodes(shapesPointer.node(), dataPointer.node())

  const { groupedActions, dedupedActions } = useMemo(() => {
    const actions: Action[] = []
    for (const mainShape of mainShapes) {
      const focusNodeMatchesForShape = focusNodeMatches.filter(match => match.shapes.term.equals(mainShape.term))
      const shapesInput = originalInput.shapes?.toString()

      // When we have a mainShape that is also the original input shape we do not allow the creation of it.
      if (shapesInput !== mainShape.term.value)
        actions.push({ type: 'create-type', shape: mainShape, data: dataPointer.node(NO_SUBJECT_GIVEN) })

      for (const focusNodeMatch of focusNodeMatchesForShape) {
        for (const focusNode of focusNodeMatch.focusNodes.terms) {
          if (focusNode.equals(NO_SUBJECT_GIVEN)) continue
          actions.push({ type: 'edit', shape: mainShape, data: dataPointer.node(focusNode) })
        }
      }
    }

    for (const subShape of subShapes) {
      const focusNodeMatchesForShape = focusNodeMatches.filter(match => match.shapes.term.equals(subShape.term))

      for (const focusNodeMatch of focusNodeMatchesForShape) {
        for (const focusNode of focusNodeMatch.focusNodes.terms) {
          const fieldUsesShape = !!shapesPointer.node().hasOut(sh('node'), subShape.term).term
          if (!fieldUsesShape) actions.push({ type: 'edit', shape: subShape, data: dataPointer.node(focusNode) })
        }
      }
    }

    const dedupedActions = [...new Map(actions.map(action => [actionId(action), action])).values()]
    const groupedActions = groupBy(dedupedActions, action => getLabel(action.shape, activeInterfaceLanguage))
    return { groupedActions, dedupedActions }
  }, [])

  const activeAction = dedupedActions.find(action => {
    const matchingShape = action.shape?.term.equals(shapeSubject)
    const dataMatches = action.data?.term.equals(dataPointer.term)
    return matchingShape && (!action.data || dataMatches)
  })

  return dedupedActions.length > 1 ? (
    <div className="action-picker">
      <label className="label">
        <Localized id="action">Action</Localized>
      </label>
      <select
        value={activeAction ? actionId(activeAction) : ''}
        onChange={event => {
          const [, shapeSubject, dataTerm] = event.target.value.split('||')
          setContext(
            initContext({
              ...context.originalInput,
              shapeSubject: factory.namedNode(shapeSubject) ?? context.originalInput.shapeSubject,
              subject: dataTerm ? factory.namedNode(dataTerm) : context.originalInput.subject
            })
          )
        }}
      >
        {Object.entries(groupedActions).map(([groupLabel, actions]) => {
          return (
            <optgroup label={groupLabel} key={groupLabel}>
              {actions.map(action => {
                const label = getLabel(action.data, activeInterfaceLanguage)
                return (
                  <option key={actionId(action)} value={actionId(action)}>
                    <Localized vars={{ type: groupLabel.toLocaleLowerCase(), thing: label }} id={action.type} />
                  </option>
                )
              })}
            </optgroup>
          )
        })}
      </select>
    </div>
  ) : null
}
