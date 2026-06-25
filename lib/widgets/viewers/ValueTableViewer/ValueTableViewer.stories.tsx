import ShaclRenderer, { ShaclRendererProps } from '../../../components/ShaclRenderer'

export default {
  title: 'Widgets/Viewers/ValueTable',
  component: ShaclRenderer,
  argTypes: {}
}

const baseUrl = new URL('/lib/widgets/viewers/ValueTableViewer/', location.href)

export const Default = {
  args: {
    mode: 'view',
    shapes: new URL('table.ttl#default', baseUrl),
    data: new URL('table.ttl#data', baseUrl)
  } as ShaclRendererProps
}
