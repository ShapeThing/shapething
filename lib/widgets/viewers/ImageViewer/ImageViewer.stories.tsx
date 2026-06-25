import ShaclRenderer, { ShaclRendererProps } from '../../../components/ShaclRenderer'

export default {
  title: 'Widgets/Viewers/Image',
  component: ShaclRenderer,
  argTypes: {}
}

const baseUrl = new URL('/lib/widgets/viewers/ImageViewer/', location.href)

export const Default = {
  args: {
    mode: 'view',
    shapes: new URL('image.ttl#default', baseUrl),
    data: new URL('image.ttl#data', baseUrl)
  } as ShaclRendererProps
}
