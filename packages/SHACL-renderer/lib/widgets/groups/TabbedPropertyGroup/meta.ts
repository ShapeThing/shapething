import Grapoi from '../../../Grapoi'
import { rdf, stsr } from '../../../core/namespaces'
import { WidgetMeta } from '../../widgets-context'

export default {
  iri: stsr('TabbedPropertyGroup'),
  score: (_data?: Grapoi, groupShape?: Grapoi) => {
    if (groupShape && groupShape.hasOut(rdf('type'), stsr('TabbedPropertyGroup')).term) {
      return 2
    }
  }
} satisfies WidgetMeta
