import ShaclRenderer, { ShaclRendererProps } from '../../../components/ShaclRenderer'

export default {
  title: 'Widgets/Editors/Address',
  component: ShaclRenderer,
  argTypes: {}
}

const baseUrl = new URL('/lib/widgets/editors/AddressEditor/', location.href)

export const Default = {
  args: {
    mode: 'edit',
    shapes: new URL('address.ttl#default', baseUrl),
    data: new URL('address.ttl#data', baseUrl),
    children: () => <></>
  } as ShaclRendererProps
}
