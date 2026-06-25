import ShaclRenderer, { ShaclRendererProps } from '../../../components/ShaclRenderer'

export default {
  title: 'Widgets/Viewers/Address',
  component: ShaclRenderer,
  argTypes: {}
}

const baseUrl = new URL('/lib/widgets/viewers/AddressViewer/', location.href)

export const Default = {
  args: {
    mode: 'view',
    shapes: new URL('address.ttl#default', baseUrl),
    data: new URL('address.ttl#data', baseUrl)
  } as ShaclRendererProps
}
