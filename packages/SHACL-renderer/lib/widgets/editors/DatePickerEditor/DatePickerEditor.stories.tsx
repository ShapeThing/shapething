import ShaclRenderer, { ShaclRendererProps } from '../../../components/ShaclRenderer'

export default {
  title: 'Widgets/Editors/DatePicker',
  component: ShaclRenderer,
  argTypes: {}
}

const baseUrl = new URL('/lib/widgets/editors/DatePickerEditor/', location.href)

export const Default = {
  args: {
    mode: 'edit',
    shapes: new URL('datepicker.ttl#default', baseUrl),
    data: new URL('datepicker.ttl#data', baseUrl),
    children: () => <></>
  } as ShaclRendererProps
}
