import Grapoi from '../../../Grapoi'
import { geo, sh, stsr } from '../../../core/namespaces'
import { WidgetMeta } from '../../widgets-context'

export default {
  iri: stsr('GeoViewer'),
  score: (data?: Grapoi, propertyShape?: Grapoi) => {
    if (
      data &&
      data.terms &&
      data.terms[0]?.termType === 'Literal' &&
      geo('wktLiteral').equals(data.terms[0].datatype)
    ) {
      return 10
    }

    if (propertyShape && geo('wktLiteral').equals(propertyShape.out(sh('datatype')).term)) {
      return 10
    }
  }
} satisfies WidgetMeta
