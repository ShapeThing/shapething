import factory from '@rdfjs/data-model'
import type { Literal } from '@rdfjs/types'
import Grapoi from '../../../Grapoi'
import { sh, stsr, xsd } from '../../../core/namespaces'
import { WidgetMeta } from '../../widgets-context'

const dataTypes = [xsd('integer'), xsd('decimal'), xsd('double'), xsd('float')]

export default {
  iri: stsr('NumberFieldEditor'),
  createTerm: () => factory.literal('', xsd('decimal')),
  score: (data?: Grapoi, propertyShape?: Grapoi) => {
    if (
      data &&
      data.term &&
      data.term.value &&
      data.term.termType === 'Literal' &&
      dataTypes.some(datatype => datatype.equals((data.term as Literal).datatype))
    ) {
      return 10
    }

    if (propertyShape && dataTypes.some(datatype => datatype.equals(propertyShape.out(sh('datatype')).term))) {
      return 5
    }
  }
} satisfies WidgetMeta
