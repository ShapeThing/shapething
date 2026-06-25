import factory from '@rdfjs/data-model'
import { stsr } from '../../../core/namespaces'
import { WidgetMeta } from '../../widgets-context'

export default {
  iri: stsr('ClassHierarchyEditor'),
  createTerm: () => factory.namedNode(''),
  hidePlusButton: true,
  noLoadingSkeleton: true,
  singleUnifiedWidget: true
} satisfies WidgetMeta
