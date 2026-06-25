/**
 * Contains the SHACL renderer component and the contexts to set it up.
 * @module
 */
import ShaclRenderer from './components/ShaclRenderer'
import FetchContextProvider from './core/fetchContext'
import { languageContext } from './core/language-context'
import { initContext, mainContext } from './core/main-context'
import type Grapoi from './Grapoi'
import { cachedFetch } from './helpers/cachedFetch'
import { language } from './helpers/language'
import { coreWidgets } from './widgets/coreWidgets'
import WidgetsContextProvider from './widgets/WidgetContextProvider'
import { widgetsContext } from './widgets/widgets-context'
export * from './components/ShaclRenderer'
export { resolveRdfInput } from './core/resolveRdfInput'
export type { WidgetMeta, WidgetProps } from './widgets/widgets-context'
export {
  cachedFetch,
  coreWidgets,
  FetchContextProvider,
  initContext,
  language,
  languageContext,
  mainContext,
  ShaclRenderer,
  widgetsContext,
  WidgetsContextProvider
}
export type { Grapoi }
