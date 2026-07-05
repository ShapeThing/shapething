import factory from '@rdfjs/data-model'
import { sh, stsr } from '../../../core/namespaces'
import Grapoi from '../../../Grapoi'
import { WidgetMeta } from '../../widgets-context'

export default {
  iri: stsr('ShapeEditor'),
  createTerm: () => factory.literal(''),
  score: (_data?: Grapoi, propertyShape?: Grapoi) => {
    if (
      propertyShape &&
      propertyShape.out(sh('path')).term?.equals(sh('property')) &&
      !propertyShape.out(stsr('nestedOrder')).term
    ) {
      return 100
    }
  },
  noLoadingSkeleton: true,
  hidePlusButton: true
} satisfies WidgetMeta
