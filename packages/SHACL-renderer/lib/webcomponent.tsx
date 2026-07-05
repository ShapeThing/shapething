import r2wc from '@r2wc/react-to-web-component'
import ShaclRenderer from './components/ShaclRenderer'

import factory from '@rdfjs/data-model'
import type { ShaclRendererProps } from './components/ShaclRenderer'

export type WebComponentProps<T extends Record<string, 'string' | 'boolean' | 'object' | 'json' | 'function'>> = {
  [K in keyof T]: T[K] extends 'string'
    ? string
    : T[K] extends 'boolean'
      ? boolean
      : T[K] extends 'json'
        ? object
        : T[K] extends 'object'
          ? object
          : T[K] extends 'function'
            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (...args: any[]) => any
            : never
}

const webComponentProps = {
  mode: 'string',
  data: 'string',
  shapes: 'string',
  facetSearchData: 'string',
  subject: 'string',
  targetClass: 'string',
  shapeSubject: 'string',
  showExtraneousPredicates: 'boolean',

  languageMode: 'string',
  contentLanguages: 'json',
  interfaceLanguages: 'json',
  activeContentLanguage: 'string',

  prefixes: 'json',
  enableActionPicker: 'boolean',
  enableSubjectEditor: 'boolean',
  subjectEditLocalNameOnly: 'boolean',
  fetch: 'function',
  store: 'function',
  onSubmit: 'function'
} as const

export const ShaclRendererWebComponent: CustomElementConstructor = r2wc(Wrapper, {
  props: webComponentProps
})

function Wrapper(props: WebComponentProps<typeof webComponentProps>) {
  const finalProps = {
    data: props.data ? new URL(props.data) : undefined,
    shapes: props.shapes ? new URL(props.shapes) : undefined,
    facetSearchData: props.facetSearchData ? new URL(props.facetSearchData) : undefined,
    mode: props.mode as 'edit' | 'view' | 'facet',
    subject: props.subject ? factory.namedNode(props.subject) : undefined,
    targetClass: props.targetClass ? factory.namedNode(props.targetClass) : undefined,
    shapeSubject: props.shapeSubject ? factory.namedNode(props.shapeSubject) : undefined,
    activeContentLanguage: props.activeContentLanguage,
    showExtraneousPredicates: props.showExtraneousPredicates ?? false,
    languageMode: props.languageMode as ShaclRendererProps['languageMode'],
    contentLanguages: props.contentLanguages as Record<string, Record<string, string>> | undefined,
    interfaceLanguages: props.interfaceLanguages as Record<string, Record<string, string>> | undefined,
    prefixes: props.prefixes as ShaclRendererProps['prefixes'],
    enableActionPicker: props.enableActionPicker ? true : undefined,
    enableSubjectEditor: props.enableSubjectEditor ? true : undefined,
    subjectEditLocalNameOnly: props.subjectEditLocalNameOnly ?? false,
    fetch: props.fetch,
    store: props.store ? (props.store() as ShaclRendererProps['store']) : undefined,
    onSubmit: props.onSubmit ? props.onSubmit : undefined
  } satisfies ShaclRendererProps

  return <ShaclRenderer {...finalProps} />
}

customElements.define('shacl-renderer', ShaclRendererWebComponent)
