import { Store } from 'n3'
import ShaclRenderer, { schema, ShaclRendererProps } from '../../../components/ShaclRenderer'
import { resolveRdfInput } from '../../../core/resolveRdfInput'

export default {
  title: 'Widgets/Editors/Autocomplete',
  component: ShaclRenderer,
  argTypes: {}
}

const baseUrl = new URL('/lib/widgets/editors/AutoCompleteEditor/autocomplete.ttl', location.href)

export const nodeKind = {
  args: {
    mode: 'edit',
    shapes: new URL('#example1', baseUrl),
    data: new URL('#data1', baseUrl),
    children: () => <></>
  } as ShaclRendererProps
}

export const classWithEndpoint = {
  args: {
    mode: 'edit',
    shapes: new URL('#example2', baseUrl),
    data: new URL('#data2', baseUrl),
    children: () => <></>
  } as ShaclRendererProps
}

const john = await resolveRdfInput(new URL('john.ttl#john', baseUrl))

export const nodeWithStore = {
  args: {
    mode: 'edit',
    shapes: new URL('#example3', baseUrl),
    data: new URL('#data3', baseUrl),
    targetClass: schema('Person'),
    store: new Store([...john.dataset])
  } as ShaclRendererProps
}

export const classWithStore = {
  args: {
    mode: 'edit',
    shapes: new URL('#example4', baseUrl),
    store: new Store([...john.dataset])
  } as ShaclRendererProps
}

// export const withEndpointAndNode = {
//   args: {
//     mode: 'edit',
//     shapes: new URL('#example5', baseUrl),
//     data: new URL('#data5', baseUrl),
//     children: () => <></>
//   } as ShaclRendererProps
// }

// export const localData = {
//   args: {
//     mode: 'edit',
//     shapes: new URL('#example6', baseUrl),
//     data: new URL('#data6', baseUrl),
//     subject: factory.namedNode(''),
//     children: () => <></>
//   } as ShaclRendererProps
// }
