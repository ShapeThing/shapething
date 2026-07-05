import ShaclRenderer, { ShaclRendererProps } from '../../../components/ShaclRenderer'

export default {
  title: 'Widgets/Groups/Tabbed',
  component: ShaclRenderer,
  argTypes: {}
}

const baseUrl = new URL('/lib/widgets/groups/TabbedPropertyGroup/', location.href)

export const Default = {
  args: {
    mode: 'edit',
    shapes: new URL('tabbed.ttl#default', baseUrl),
    data: new URL('tabbed.ttl#data', baseUrl),
    children: () => <></>
  } as ShaclRendererProps
}
