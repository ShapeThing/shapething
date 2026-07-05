import ShaclRenderer, { ShaclRendererProps } from '../../../components/ShaclRenderer'

export default {
  title: 'Widgets/Editors/Radios',
  component: ShaclRenderer,
  argTypes: {}
}

const baseUrl = new URL('/lib/widgets/editors/RadiosEditor/', location.href)

export const Default = {
  args: {
    mode: 'edit',
    shapes: new URL('radios.ttl#default', baseUrl),
    data: new URL('radios.ttl#data', baseUrl),
    children: () => <></>
  } as ShaclRendererProps
}
