import ShaclRenderer, { ShaclRendererProps } from '../../../components/ShaclRenderer'

export default {
  title: 'Widgets/Editors/NumberField',
  component: ShaclRenderer,
  argTypes: {}
}

const baseUrl = new URL('/lib/widgets/editors/NumberFieldEditor/', location.href)

export const Default = {
  args: {
    mode: 'edit',
    shapes: new URL('numberfield.ttl#default', baseUrl),
    data: new URL('numberfield.ttl#data', baseUrl),
    children: () => <></>
  } as ShaclRendererProps
}
