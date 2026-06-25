import ShaclRenderer, { ShaclRendererProps, schema } from '../../components/ShaclRenderer'
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
