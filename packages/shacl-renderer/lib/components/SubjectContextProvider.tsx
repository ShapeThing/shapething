import type { Quad_Subject } from '@rdfjs/types'
import { createContext, ReactNode } from 'react'

export const subjectContext = createContext<{ subject: Quad_Subject }>({
  subject: undefined as unknown as Quad_Subject
})

type Props = {
  subject: Quad_Subject
  children: ReactNode
}

export function SubjectContextProvider({ subject, children }: Props) {
  return <subjectContext.Provider value={{ subject }}>{children}</subjectContext.Provider>
}
