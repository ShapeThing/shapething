import ShaclRenderer, { ShaclRendererProps } from '../../../components/ShaclRenderer'

export default {
  title: 'Widgets/Editors/Iconify',
  component: ShaclRenderer,
  argTypes: {}
}

const baseUrl = new URL('/lib/widgets/editors/IconifyEditor/', location.href)

export const Default = {
  args: {
    mode: 'edit',
    shapes: new URL('iconify-default.ttl#default', baseUrl),
    data: new URL('iconify-default.ttl#data', baseUrl),
    children: () => <></>
  } as ShaclRendererProps
}

export const WithLimit = {
  args: {
    mode: 'edit',
    shapes: new URL('iconify-limit.ttl#with-limit', baseUrl),
    children: () => <></>
  } as ShaclRendererProps
}
