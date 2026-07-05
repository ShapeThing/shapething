import ShaclRenderer, { ShaclRendererProps } from '../../../components/ShaclRenderer'

export default {
  title: 'Widgets/Editors/Shape',
  component: ShaclRenderer,
  argTypes: {}
}

const baseUrl = new URL('/lib/widgets/editors/ShapeEditor/', location.href)

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
    contentLanguages: languageLabels,
    shapes: new URL('shape.ttl', baseUrl),
    data: new URL('person.ttl', baseUrl),
    children: () => <></>,
    interfaceLanguages: {
      en: {
        en: 'English'
      }
    }
  } as ShaclRendererProps
}
