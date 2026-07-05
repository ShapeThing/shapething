import ShaclRenderer, { ShaclRendererProps } from '../../../components/ShaclRenderer'

export default {
  title: 'Widgets/Editors/EnumSelect',
  component: ShaclRenderer,
  argTypes: {}
}

const baseUrl = new URL('/lib/widgets/editors/EnumSelectEditor/', location.href)

export const Default = {
  args: {
    mode: 'edit',
    shapes: new URL('enum-select.ttl#default', baseUrl),
    data: new URL('enum-select.ttl#data', baseUrl),
    children: () => <></>
  } as ShaclRendererProps
}

export const Classes = {
  args: {
    mode: 'edit',
    shapes: new URL('enum-select-classes.ttl#default', baseUrl),
    data: new URL('enum-select-classes.ttl#data', baseUrl),
    children: () => <></>
  } as ShaclRendererProps
}
