import ShaclRenderer, { ShaclRendererProps } from '../../components/ShaclRenderer'
import { schema } from '../../core/namespaces'
export default {
  title: 'Capabilities/Facet',
  component: ShaclRenderer,
  argTypes: {}
}

const baseUrl = new URL('/lib/stories/facet/', location.href)

export const Facets = {
  args: {
    mode: 'facet',
    facetSearchData: new URL('people.ttl', baseUrl),
    shapes: new URL('contact.ttl', baseUrl),
    targetClass: schema('Person')
  } as ShaclRendererProps
}
