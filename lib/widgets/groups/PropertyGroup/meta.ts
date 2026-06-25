import Grapoi from '../../../Grapoi'
import { rdf, sh } from '../../../core/namespaces'
import { WidgetMeta } from '../../widgets-context'

export default {
  iri: sh('PropertyGroup'),
  score: (_data?: Grapoi, groupShape?: Grapoi) => {
    if (groupShape && groupShape.hasOut(rdf('type'), sh('PropertyGroup')).term) {
      return 1
    }
  }
} satisfies WidgetMeta
