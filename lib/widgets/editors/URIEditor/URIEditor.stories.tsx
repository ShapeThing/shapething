import ShaclRenderer, { ShaclRendererProps } from '../../../components/ShaclRenderer'

export default {
  title: 'Widgets/Editors/URI',
  component: ShaclRenderer,
  argTypes: {}
}

const baseUrl = new URL('/lib/widgets/editors/URIEditor/', location.href)

export const Default = {
  args: {
    mode: 'edit',
    shapes: new URL('uri.ttl#default', baseUrl),
    data: new URL('uri.ttl#data', baseUrl),
    children: () => <></>
  } as ShaclRendererProps
}
