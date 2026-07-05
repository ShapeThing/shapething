import ShaclRenderer, { ShaclRendererProps } from '../../../components/ShaclRenderer'

export default {
  title: 'Widgets/Groups/Horizontal',
  component: ShaclRenderer,
  argTypes: {}
}

const baseUrl = new URL('/lib/widgets/groups/HorizontalPropertyGroup/', location.href)

export const Default = {
  args: {
    mode: 'edit',
    shapes: new URL('horizontal.ttl#default', baseUrl),
    data: new URL('horizontal.ttl#data', baseUrl),
    children: () => <></>
  } as ShaclRendererProps
}
