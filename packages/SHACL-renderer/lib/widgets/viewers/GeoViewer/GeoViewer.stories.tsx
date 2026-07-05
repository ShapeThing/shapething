import ShaclRenderer, { ShaclRendererProps } from '../../../components/ShaclRenderer'

export default {
  title: 'Widgets/Viewers/Geo',
  component: ShaclRenderer,
  argTypes: {}
}

const baseUrl = new URL('/lib/widgets/viewers/GeoViewer/', location.href)

export const Default = {
  args: {
    mode: 'view',
    shapes: new URL('geo.ttl#default', baseUrl),
    data: new URL('geo.ttl#data', baseUrl)
  } as ShaclRendererProps
}
