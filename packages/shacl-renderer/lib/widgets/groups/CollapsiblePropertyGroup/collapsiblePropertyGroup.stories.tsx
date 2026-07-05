import ShaclRenderer, { ShaclRendererProps } from '../../../components/ShaclRenderer'

export default {
  title: 'Widgets/Groups/Collapsible',
  component: ShaclRenderer,
  argTypes: {}
}

const baseUrl = new URL('/lib/widgets/groups/CollapsiblePropertyGroup/', location.href)

export const Default = {
  args: {
    mode: 'edit',
    shapes: new URL('collapsible.ttl#default', baseUrl),
    data: new URL('collapsible.ttl#data', baseUrl),
    children: () => <></>
  } as ShaclRendererProps
}
