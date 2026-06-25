import ShaclRenderer, { ShaclRendererProps } from '../../../components/ShaclRenderer'

export default {
  title: 'Widgets/Editors/Duration',
  component: ShaclRenderer,
  argTypes: {}
}

const baseUrl = new URL('/lib/widgets/editors/DurationEditor/', location.href)

export const Default = {
  args: {
    mode: 'edit',
    shapes: new URL('duration.ttl#default', baseUrl),
    data: new URL('duration.ttl#data', baseUrl),
    children: () => <></>
  } as ShaclRendererProps
}
