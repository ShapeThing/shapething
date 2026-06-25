import ShaclRenderer, { ShaclRendererProps } from '../../../components/ShaclRenderer'

export default {
  title: 'Widgets/Groups/Drawer',
  component: ShaclRenderer,
  argTypes: {}
}

const baseUrl = new URL('/lib/widgets/groups/DrawerPropertyGroup/', location.href)

export const Default = {
  args: {
    mode: 'edit',
    shapes: new URL('drawer.ttl#default', baseUrl),
    data: new URL('drawer.ttl#data', baseUrl),
    children: () => <></>
  } as ShaclRendererProps
}
