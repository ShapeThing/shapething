import ShaclRenderer, { ShaclRendererProps } from '../../../components/ShaclRenderer'

export default {
  title: 'Widgets/Editors/BooleanSelect',
  component: ShaclRenderer,
  argTypes: {}
}

const baseUrl = new URL('/lib/widgets/editors/BooleanSelectEditor/', location.href)

export const Default = {
  args: {
    mode: 'edit',
    shapes: new URL('boolean-select.ttl#default', baseUrl),
    data: new URL('boolean-select.ttl#data', baseUrl),
    children: () => <></>
  } as ShaclRendererProps
}
