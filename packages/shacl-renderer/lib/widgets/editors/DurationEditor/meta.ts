import factory from '@rdfjs/data-model'
import Grapoi from '../../../Grapoi'
import { sh, stsr, xsd } from '../../../core/namespaces'
import { TouchableTerm } from '../../../helpers/touchableRdf'
import { WidgetMeta } from '../../widgets-context'

export default {
  iri: stsr('DurationEditor'),
  createTerm: () => factory.literal('', xsd('duration')),
  score: (data?: Grapoi, propertyShape?: Grapoi) => {
    const term = data?.terms[0]

    if (
      term &&
      (term.value || (term as TouchableTerm).touched === false) &&
      term.termType === 'Literal' &&
      term.datatype.equals(xsd('duration'))
    ) {
      return 15
    }

    if (propertyShape && propertyShape.out(sh('datatype')).term?.equals(xsd('duration'))) {
      return 10
    }
  }
} satisfies WidgetMeta
