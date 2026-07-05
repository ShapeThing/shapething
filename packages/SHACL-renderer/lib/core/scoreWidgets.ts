import type { NamedNode } from '@rdfjs/types'
import Grapoi from '../Grapoi'
import { TouchableTerm } from '../helpers/touchableRdf'
import type { WidgetItem } from '../widgets/widgets-context'
import { stsr } from './namespaces'

export const scoreWidgets = (widgets: Array<WidgetItem>, data?: Grapoi, property?: Grapoi, predicate?: NamedNode) => {
  // TODO should a fixed widget value be overridden when the algorithms do not match?
  // Meaning: there might be two categories of cases: multiple widgets that are allowed and one is fixed,
  // and a fixed widget whose algorithm does not match
  if (predicate) {
    const selectedWidgetIri = property?.out(predicate).term
    if (selectedWidgetIri) {
      if (selectedWidgetIri?.equals(stsr('HideWidget'))) return null
      const selectedWidget = widgets.find(widget => widget.meta.iri.equals(selectedWidgetIri))
      if (selectedWidget) return selectedWidget
    }
  }

  const widgetMatches = widgets
    .map(widgetItem => {
      const score = widgetItem.meta.score
        ? widgetItem.meta.score(
            data?.filter(pointer => (pointer?.terms?.[0] as TouchableTerm)?.touched !== false),
            property
          )
        : -1
      return { widgetItem, score: score === undefined ? -1 : score }
    })
    .sort((a, b) => b.score - a.score)

  return widgetMatches.filter(({ score }) => score > -1)[0]?.widgetItem
}
