import ShaclRenderer, { ShaclRendererProps } from '../../../components/ShaclRenderer'

export default {
  title: 'Widgets/Viewers/Label',
  component: ShaclRenderer,
  argTypes: {}
}

const baseUrl = new URL('/lib/widgets/viewers/LabelViewer/', location.href)

export const Default = {
  args: {
    mode: 'view',
    shapes: new URL('label.ttl#default', baseUrl),
    data: new URL('label.ttl#data', baseUrl)
  } as ShaclRendererProps
}
