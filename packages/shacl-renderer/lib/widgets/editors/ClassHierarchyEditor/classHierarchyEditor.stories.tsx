import ShaclRenderer, { ShaclRendererProps } from '../../../components/ShaclRenderer'

export default {
  title: 'Widgets/Editors/ClassHierarchy',
  component: ShaclRenderer,
  argTypes: {}
}

const baseUrl = new URL('/lib/widgets/editors/ClassHierarchyEditor/', location.href)
const languageLabels = {
  en: {
    nl: 'Engels',
    en: 'English'
  },
  nl: {
    en: 'Dutch',
    nl: 'Nederlands'
  }
}
export const Default = {
  args: {
    mode: 'edit',
    shapes: new URL('class-hierarchy.ttl#default', baseUrl),
    data: new URL('class-hierarchy.ttl#data', baseUrl),
    interfaceLanguages: languageLabels,
    children: () => <></>
  } as ShaclRendererProps
}
