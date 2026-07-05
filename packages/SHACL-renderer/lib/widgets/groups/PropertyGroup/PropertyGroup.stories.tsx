import ShaclRenderer, { ShaclRendererProps } from '../../../components/ShaclRenderer'

export default {
  title: 'Widgets/Groups/Group',
  component: ShaclRenderer,
  argTypes: {}
}

const baseUrl = new URL('/lib/widgets/groups/PropertyGroup/', location.href)

export const Default = {
  args: {
    mode: 'edit',
    shapes: new URL('default.ttl#default', baseUrl),
    data: new URL('default.ttl#data', baseUrl),
    children: () => <></>
  } as ShaclRendererProps
}
