import ShaclRenderer, { ShaclRendererProps } from '../../../components/ShaclRenderer'

export default {
  title: 'Widgets/Editors/Color',
  component: ShaclRenderer,
  argTypes: {}
}

const baseUrl = new URL('/lib/widgets/editors/ColorEditor/', location.href)

export const Default = {
  args: {
    mode: 'edit',
    shapes: new URL('color.ttl#default', baseUrl),
    data: new URL('color.ttl#data', baseUrl),
    children: () => <></>
  } as ShaclRendererProps
}
