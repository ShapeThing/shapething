import { JSX, ReactNode } from 'react'
import { widgetsContext, WidgetsContext } from './widgets-context'

type WidgetsContextProviderProps = { children: ReactNode } & Partial<WidgetsContext>
/**
 * Use this to add your own widgets to the SHACL renderer.
 */
export default function WidgetsContextProvider({
  children,
  editors = [],
  viewers = [],
  facets = [],
  lists = [],
  groups = []
}: WidgetsContextProviderProps): JSX.Element {
  return (
    <widgetsContext.Provider
      value={{
        editors,
        viewers,
        facets,
        groups,
        lists
      }}
    >
      {children}
    </widgetsContext.Provider>
  )
}
