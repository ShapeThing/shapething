import type { StoryObj } from '@storybook/react'
import { Store } from 'n3'
import { expect, waitFor, within } from 'storybook/test'
import ShaclRenderer, { ShaclRendererProps, schema } from '../../components/ShaclRenderer'
import { resolveRdfInput } from '../../core/resolveRdfInput'

type Story = StoryObj<typeof ShaclRenderer>
const baseUrl = new URL('/lib/stories/edit/', location.href)

export default {
  title: 'Capabilities/Form',
  component: ShaclRenderer,
  argTypes: {}
}

export const CreateWithShape = {
  args: {
    mode: 'edit',
    shapes: new URL('contact.ttl', baseUrl),
    enableSubjectEditor: true
  } as ShaclRendererProps
}

export const EditWithShape = {
  args: {
    mode: 'edit',
    data: new URL('john.ttl#john', baseUrl),
    shapes: new URL('contact-closed.ttl', baseUrl)
  } as ShaclRendererProps
}

export const SortableData = {
  args: {
    mode: 'edit',
    data: new URL('ordered-list.ttl#data', baseUrl),
    shapes: new URL('ordered-list.ttl#shape', baseUrl),
    children: () => <></>,
    targetClass: schema('Person')
  } as ShaclRendererProps
}

export const SortableDataEmpty = {
  args: {
    mode: 'edit',
    shapes: new URL('ordered-list.ttl#shape', baseUrl),
    targetClass: schema('Person'),
    children: () => <></>
  } as ShaclRendererProps
}

export const MultipleFormsCreate = {
  args: {
    mode: 'edit',
    enableActionPicker: true,
    shapes: new URL('multiple-forms.ttl', baseUrl)
  } as ShaclRendererProps
}

export const MultipleFormsEdit = {
  args: {
    mode: 'edit',
    enableActionPicker: true,
    shapes: new URL('multiple-forms.ttl', baseUrl),
    data: new URL('multiple-forms-data.ttl', baseUrl)
  } as ShaclRendererProps
}

export const Inheritance: Story = {
  args: {
    mode: 'edit',
    shapes: new URL('inheritance.ttl#pet', baseUrl)
  } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(
      () => {
        expect(canvas.getByText('A field from ex:Thing')).toBeInTheDocument()
        expect(canvas.getByText('A field from ex:Animal')).toBeInTheDocument()
        expect(canvas.getByText('A field from ex:Pet')).toBeInTheDocument()
      },
      { timeout: 4000 }
    )
  }
}
export const EditWithoutShape = {
  args: {
    mode: 'edit',
    data: new URL('john.ttl#john', baseUrl)
  } as ShaclRendererProps
}

export const InvalidData = {
  args: {
    mode: 'edit',
    data: new URL('john-invalid.ttl', baseUrl),
    shapes: new URL('contact-invalid.ttl', baseUrl),
    targetClass: schema('Person')
  } as ShaclRendererProps
}

export const ShapesGraph = {
  args: {
    mode: 'edit',
    data: new URL('john-with-shapes-graph.ttl', baseUrl)
  } as ShaclRendererProps
}

export const MixedObjects = {
  args: {
    mode: 'edit',
    shapes: new URL('mixed-objects.ttl', baseUrl),
    data: new URL('mixed-objects-data.ttl', baseUrl)
  } as ShaclRendererProps
}

const john = await resolveRdfInput(new URL('john.ttl#john', baseUrl))
export const EditWithExternalStore = {
  args: {
    mode: 'edit',
    data: new URL('external-store.ttl#data', baseUrl),
    shapes: new URL('external-store.ttl#shape', baseUrl),
    targetClass: schema('Person'),
    store: new Store([...john.dataset])
  } as ShaclRendererProps
}

export const Conditionals: Story = {
  args: {
    mode: 'edit',
    shapes: new URL('conditional.ttl', baseUrl),
    children: () => <></>
  } as ShaclRendererProps,
  play: async ({ userEvent, canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(document.body)

    await waitFor(
      () => {
        const dropdowns = canvas.getAllByText('- Pick an option -')
        expect(dropdowns[0]).toBeInTheDocument()
      },
      { timeout: 4000 }
    )
    const dropdowns = canvas.getAllByText('- Pick an option -')
    await expect(dropdowns[0]).toBeVisible()
    await userEvent.click(dropdowns[0])
    await waitFor(
      () => {
        const option = body.getByText('Clothing')
        expect(option).toBeInTheDocument()
      },
      { timeout: 4000 }
    )
    const option = body.getByText('Clothing')
    await expect(option).toBeVisible()
    await userEvent.click(option)
    await waitFor(
      async () => {
        const sizeLabel = canvas.getByText('Size')
        await expect(sizeLabel).toBeVisible()
      },
      { timeout: 4000 }
    )
    const remove = canvas.getByTestId('remove-object')
    await userEvent.click(remove)
  }
}

export const Conditionals2: Story = {
  args: {
    mode: 'edit',
    shapes: new URL('conditional2.ttl', baseUrl),
    children: () => <></>
  } as ShaclRendererProps
}

export const Reverse = {
  args: {
    mode: 'edit',
    shapes: new URL('reverse.ttl', baseUrl),
    data: new URL('reverse.ttl#john', baseUrl),
    children: () => <></>
  } as ShaclRendererProps
}
export const OntologyDereference = {
  args: {
    mode: 'edit',
    dereferenceCommentsAsDescriptions: true,
    shapes: new URL('ontology-dereference.ttl', baseUrl),
    data: new URL('ontology-dereference.ttl#data', baseUrl),
    children: () => <></>
  } as ShaclRendererProps
}

const languages = {
  en: {
    en: 'English',
    de: 'Englisch',
    nl: 'Engels'
  },
  nl: {
    nl: 'Nederlands',
    de: 'Niederländisch',
    en: 'Dutch'
  },
  de: {
    en: 'German',
    nl: 'Duits',
    de: 'Deutsch'
  }
}

export const MultilingualWithTabs = {
  args: {
    mode: 'edit',
    data: new URL('multilingual-data.ttl', baseUrl),
    shapes: new URL('multilingual.ttl', baseUrl),
    languageMode: 'tabs',
    contentLanguages: languages
  } as ShaclRendererProps
}

export const MultilingualIndividual = {
  args: {
    mode: 'edit',
    data: new URL('multilingual-data.ttl', baseUrl),
    shapes: new URL('multilingual.ttl', baseUrl),
    languageMode: 'individual',
    contentLanguages: languages,
    children: () => <></>
  } as ShaclRendererProps
}

export const InterfaceLanguage = {
  args: {
    mode: 'edit',
    shapes: new URL('contact.ttl', baseUrl),
    data: new URL('john.ttl', baseUrl),
    activeInterfaceLanguage: 'nl',
    interfaceLanguages: {
      en: {
        en: 'English',
        nl: 'Engels'
      },
      nl: {
        nl: 'Nederlands',
        en: 'Dutch'
      }
    }
  } as ShaclRendererProps
}

export const EditJSONWithShape = {
  args: {
    mode: 'edit',
    context: {
      '@vocab': 'https://schema.org/'
    },
    data: {
      givenName: 'John',
      familyName: 'Doe',
      child: ['Jane Doe', 'Jack Doe'],
      // birthDate: new Date('1980-01-01'),
      address: {
        streetAddress: '123 Main St',
        postalCode: '12345',
        addressLocality: 'Anytown',
        addressCountry: 'US',
        addressRegion: 'CA'
      }
    },
    shapes: new URL('contact.ttl', baseUrl)
  } as ShaclRendererProps
}

// export const CustomWidgets = {
//   decorators: [
//     // eslint-disable-next-line @typescript-eslint/no-explicit-any
//     (Story: any) => {
//       return (
//         <WidgetsContextProvider editors={[]}>
//           <Story />
//         </WidgetsContextProvider>
//       )
//     }
//   ],
//   args: {
//     mode: 'edit',
//     data: new URL('john.ttl#john', baseUrl),
//     shapes: new URL('contact-closed.ttl', baseUrl)
//   } as ShaclRendererProps
// }
