import factory from '@rdfjs/data-model'
import ShaclRenderer, { ShaclRendererProps } from '../../components/ShaclRenderer'

const baseUrl = new URL('/lib/stories/showcase/', location.href)

export default {
  title: 'Showcase',
  component: ShaclRenderer,
  argTypes: {}
}

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

export const EditPersonShape = {
  args: {
    mode: 'edit',
    shapes: new URL('shapething-nodeshape.ttl', baseUrl),
    data: new URL('shapething-person.ttl', baseUrl),
    activeInterfaceLanguage: 'nl',
    activeContentLanguage: 'nl',
    contentLanguages: languageLabels,
    interfaceLanguages: {
      nl: {
        nl: 'Nederlands'
      }
    }
  } as ShaclRendererProps
}

export const CreatePerson = {
  args: {
    mode: 'edit',
    shapes: new URL('shapething-person.ttl', baseUrl)
  } as ShaclRendererProps
}

export const Academic = {
  args: {
    mode: 'edit',
    subject: factory.namedNode('http://example.org/alice'),
    shapes: new URL('academic.ttl', baseUrl),
    data: new URL('academic-data.ttl', baseUrl)
  } as ShaclRendererProps
}

export const Recipe = {
  args: {
    mode: 'edit',
    shapes: new URL('recipe.ttl', baseUrl),
    activeInterfaceLanguage: 'en',
    activeContentLanguage: 'en',
    contentLanguages: languageLabels,
    interfaceLanguages: languageLabels
  } as ShaclRendererProps
}
