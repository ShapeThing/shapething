import ShaclRenderer, { ShaclRendererProps } from '../../../components/ShaclRenderer'

export default {
  title: 'Widgets/Editors/TextField',
  component: ShaclRenderer,
  argTypes: {}
}

const baseUrl = new URL('/lib/widgets/editors/TextFieldEditor/', location.href)

export const Default = {
  args: {
    mode: 'edit',
    shapes: new URL('textfield.ttl#default', baseUrl),
    data: new URL('textfield.ttl#data', baseUrl),
    children: () => <></>
  } as ShaclRendererProps
}
