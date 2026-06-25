import ShaclRenderer, { ShaclRendererProps } from '../../../components/ShaclRenderer'

export default {
  title: 'Widgets/Editors/EditorJs',
  component: ShaclRenderer,
  argTypes: {}
}

const baseUrl = new URL('/lib/widgets/editors/EditorJsEditor/', location.href)

export const Default = {
  args: {
    mode: 'edit',
    shapes: new URL('editor-js.shape.ttl#default', baseUrl),
    data: new URL('editor-js.data.ttl#data', baseUrl),
    children: () => <></>
  } as ShaclRendererProps
}
