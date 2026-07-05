import type { NamedNode, Term } from '@rdfjs/types'
import { ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { useGroupLabel } from '../hooks/useGroupLabel'
import { mainContext } from './main-context'
import { rdf, sh, stsr } from './namespaces'
import { tabbedPropertyGroupContext } from './tabbedPropertyGroupContext'

function TabbedGroupButton({ allTabIris, iri }: { allTabIris: NamedNode[]; iri: NamedNode }) {
  const { setActiveTabbedGroupIris, activeTabbedGroupIris } = useContext(tabbedPropertyGroupContext)
  const { shapePointer, dataPointer } = useContext(mainContext)

  const label = useGroupLabel(shapePointer.node(iri), dataPointer)
  const active = activeTabbedGroupIris.some(activeTabbedGroupIri => activeTabbedGroupIri.equals(iri))

  return (
    <button
      className={active ? 'button primary' : 'button secondary outline'}
      onClick={() => {
        setActiveTabbedGroupIris(activeTabbedGroupIris => [
          ...activeTabbedGroupIris.filter(
            activeTabbedGroupIri => !allTabIris.some(allTabIri => activeTabbedGroupIri.equals(allTabIri))
          ),
          iri
        ])
      }}
    >
      {label}
    </button>
  )
}

export function TabbedPropertyGroupContextProvider({ children }: { children: ReactNode }) {
  const { activeTabbedGroupIris: initialActiveTabbedGroupIris, shapePointer } = useContext(mainContext)
  const [activeTabbedGroupIris, setActiveTabbedGroupIris] = useState<NamedNode[]>(initialActiveTabbedGroupIris)

  const allTabIris = useMemo(
    () =>
      shapePointer
        .node()
        .out(sh('property'))
        .out(sh('group'))
        .hasOut(rdf('type'), stsr('TabbedPropertyGroup'))
        .distinct()
        .terms.sort((a: Term, b: Term) => {
          const aOrder = parseFloat(shapePointer.node(a).out(sh('order')).value ?? '0')
          const bOrder = parseFloat(shapePointer.node(b).out(sh('order')).value ?? '0')
          return aOrder - bOrder
        }) as NamedNode[],
    [shapePointer]
  )

  useEffect(() => {
    const activeTabs = activeTabbedGroupIris.filter(activeTabbedGroupIri =>
      allTabIris.some(tabIri => tabIri.equals(activeTabbedGroupIri))
    )

    if (activeTabs.length > 1) {
      throw new Error('Somehow multiple tabs are set active')
    } else if (activeTabs.length === 0) {
      setActiveTabbedGroupIris(activeTabbedGroupIris => [...activeTabbedGroupIris, allTabIris[0]])
    }
  }, [])

  return (
    <tabbedPropertyGroupContext.Provider value={{ activeTabbedGroupIris, setActiveTabbedGroupIris }}>
      {allTabIris.length ? (
        <nav className="tabbed-navigation">
          {allTabIris.map(iri => (
            <TabbedGroupButton key={iri.value} iri={iri} allTabIris={allTabIris} />
          ))}
        </nav>
      ) : null}

      {children}
    </tabbedPropertyGroupContext.Provider>
  )
}
