import { Localized } from '@fluent/react'
import { write } from '@jeswr/pretty-turtle'
import factory from '@rdfjs/dataset'
import { Suspense, use, useContext, useEffect, useRef, useState } from 'react'
import { fetchContext } from '../core/fetchContext'
import LanguageProvider from '../core/language-context'
import { initContext, MainContext, MainContextInput } from '../core/main-context'
import ValidationContextProvider from '../core/validation/validation-context'
import { cleanUpDataset } from '../helpers/cleanUpDataset'
import { rdfToData } from '../tools/data/rdfToData'
import LanguageAwareTabs from './language/LanguageAwareTabs'
import { MainContextProvider } from './MainContextProvider'
import NodeShape from './NodeShape'
import { prefixes } from './ShaclRenderer'
import ActionPicker from './various/ActionPicker'
export * from '../core/namespaces'

export type ShaclRendererProps = MainContextInput

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ShaclRendererInner(props: ShaclRendererProps & { contextResource: any }) {
  const [contextResource, setContextResource] = useState(props.contextResource)
  const context: MainContext = use(contextResource)

  const submit = async () => {
    const datasetCopy = factory.dataset([...context.data])
    cleanUpDataset(datasetCopy)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let json: any = {}

    try {
      ;[json] = await rdfToData({
        shapes: context.originalInput.shapes,
        data: datasetCopy,
        showExtraneousPredicates: context.originalInput.showExtraneousPredicates,
        context: context.originalInput.context ?? {},
        compactValues: context.originalInput.compactValues
      })
    } catch (error) {
      console.error(error)
    }

    if (props.onSubmit) {
      await props.onSubmit({
        dataset: datasetCopy,
        context,
        dataPointer: context.dataPointer,
        json,
        prefixes: {
          ...prefixes,
          ...context.jsonLdContext.getContextRaw()
        }
      })
    }
    // For now this is helpful for debugging.
    else {
      const turtle = await write([...datasetCopy], {
        prefixes: {
          ...prefixes,
          ...context.jsonLdContext.getContextRaw()
        }
      })
      console.log(json)
      console.log(turtle)
    }
  }

  return (
    <MainContextProvider context={context}>
      <LanguageProvider>
        <ValidationContextProvider>
          <ActionPicker setContext={setContextResource} />
          <LanguageAwareTabs>
            <NodeShape key="root" />
            <div className="actions">
              {props.children ? (
                props.children(submit)
              ) : ['edit', 'inline-edit'].includes(context.mode) ? (
                <button onClick={submit} className="button primary big">
                  <Localized id="save">Save</Localized>
                </button>
              ) : null}
            </div>
          </LanguageAwareTabs>
        </ValidationContextProvider>
      </LanguageProvider>
    </MainContextProvider>
  )
}

/**
 * A React component that renders a SHACL shape (if given) as a form, a view or facets
 */
export default function ShaclRenderer(props: ShaclRendererProps) {
  const { fetch } = useContext(fetchContext)
  const contextResource = useRef<Promise<MainContext>>(null)

  const [hasBeenMounted, setHasBeenMounted] = useState(false)
  useEffect(() => {
    if (contextResource.current === null) {
      contextResource.current = initContext({ ...props, fetch })
      setHasBeenMounted(true)
    }
  }, [])

  return hasBeenMounted ? (
    <div data-mode={props.mode} className="shacl-renderer">
      <Suspense fallback={props.fallback}>
        <ShaclRendererInner contextResource={contextResource.current} {...props} />
      </Suspense>
    </div>
  ) : null
}
