import factory from '@rdfjs/data-model'
import { sh, stsr } from '../../../core/namespaces'
import { WidgetMeta } from '../../widgets-context'

export default {
  iri: stsr('RadiosEditor'),
  hidePlusButton: true,
  noLoadingSkeleton: true,
  singleUnifiedWidget: true,
  createTerm: (_language, property) => {
    // Mode can be async via sh:select or sh:in ()
    const modeIsList = property?.out(sh('in')).isList()
    if (modeIsList === true) {
      const options = [...(property?.out(sh('in')).list() ?? [])]
      return options[0].term.termType === 'NamedNode' ? factory.namedNode('') : factory.literal('')
    } else if (modeIsList === false) {
      return factory.namedNode('')
    } else {
      return factory.namedNode('')
    }
  }
} satisfies WidgetMeta
