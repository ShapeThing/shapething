import ShaclRenderer, { ShaclRendererProps } from '../../../components/ShaclRenderer'

export default {
  title: 'Widgets/Editors/FileUpload',
  component: ShaclRenderer,
  argTypes: {}
}

const baseUrl = new URL('/lib/widgets/editors/FileUploadEditor/', location.href)

export const Default = {
  args: {
    mode: 'edit',
    shapes: new URL('fileupload.ttl#default', baseUrl),
    data: new URL('fileupload.ttl#data', baseUrl),
    children: () => <></>
  } as ShaclRendererProps
}
