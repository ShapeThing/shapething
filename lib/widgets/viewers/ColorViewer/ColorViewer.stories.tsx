import ShaclRenderer, { ShaclRendererProps } from '../../../components/ShaclRenderer'

export default {
  title: 'Widgets/Viewers/Color',
  component: ShaclRenderer,
  argTypes: {}
}

const baseUrl = new URL('/lib/widgets/viewers/ColorViewer/', location.href)

export const Default = {
  args: {
    mode: 'view',
    shapes: new URL('color.ttl#default', baseUrl),
    data: new URL('color.ttl#data', baseUrl)
  } as ShaclRendererProps
}
