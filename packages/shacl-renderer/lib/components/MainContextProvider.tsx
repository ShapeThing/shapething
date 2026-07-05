import type { NamedNode, Quad_Subject } from '@rdfjs/types'
import { ReactNode, useMemo, useReducer } from 'react'
import { mainContext, MainContext } from '../core/main-context'
import { Rerenderer } from '../core/Rerenderer'
import { renameSubject as renameSubjectFull } from '../helpers/renameSubject'

type MainContextProviderProps = {
  children?: ReactNode
  context: MainContext
}

/**
 * A main context for the SHACL renderer.
 * No need to init this yourself except in edge cases.
 */
export function MainContextProvider({ children, context }: MainContextProviderProps) {
  const [updates, update] = useReducer(x => x + 1, 0)

  const rerenderer = useMemo(() => new Rerenderer(), [])

  const renameSubject = (newSubject: Quad_Subject) => {
    if (!newSubject.equals(context.subject)) {
      renameSubjectFull(context.data, context.subject, newSubject)
      context.dataPointer = context.dataPointer.node(newSubject)
      context.subject = newSubject as NamedNode
    }
    update()
  }
  return context ? (
    <mainContext.Provider value={{ ...context, renameSubject, updates, update, rerenderer }}>
      {children}
    </mainContext.Provider>
  ) : null
}
