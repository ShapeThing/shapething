import ShaclRenderer, { ShaclRendererProps } from '../../../components/ShaclRenderer'

export default {
  title: 'Widgets/Viewers/Iconify',
  component: ShaclRenderer,
  argTypes: {}
}

const baseUrl = new URL('/lib/widgets/viewers/IconifyViewer/', location.href)

export const Default = {
  args: {
    mode: 'view',
    shapes: new URL('iconify-default.ttl', baseUrl),
    data: new URL('iconify-default.ttl#data', baseUrl)
  } as ShaclRendererProps
}
