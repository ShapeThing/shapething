import type { NamedNode } from '@rdfjs/types'
import { createContext, Dispatch, SetStateAction } from 'react'

export const tabbedPropertyGroupContext = createContext<{
  setActiveTabbedGroupIris: Dispatch<SetStateAction<NamedNode[]>>
  activeTabbedGroupIris: NamedNode[]
}>({
  setActiveTabbedGroupIris: () => {
    throw new Error('Implement')
  },
  activeTabbedGroupIris: []
})
