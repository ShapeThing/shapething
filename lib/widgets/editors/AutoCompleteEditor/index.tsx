import factory from '@rdfjs/data-model'
import { NamedNode } from '@rdfjs/types'
import { Store } from 'n3'
import { useCallback, useContext, useEffect, useRef, useState, useTransition } from 'react'
import { MemoIcon } from '../../../components/various/Icon'
import Image from '../../../components/various/Image'
import { languageContext } from '../../../core/language-context'
import { mainContext } from '../../../core/main-context'
import { stsr } from '../../../core/namespaces'
import { getPurposePredicates } from '../../../helpers/getPurposePredicates'
import { editIcon } from '../../../helpers/icons'
import { useDebounced } from '../../../hooks/useDebounced'
import { WidgetProps } from '../../widgets-context'
import { iriFetch } from './fetchers'
import { searcher } from './searchers'

// TODO consider default stsr:endpoint via global settings.
// TODO add searching indicator
export default function AutoCompleteEditor({ term, setTerm, property }: WidgetProps) {
  const labelPredicates = getPurposePredicates('label', property)
  const imagePredicates = getPurposePredicates('image', property)
  const endpoint = property.out(stsr('endpoint')).term as NamedNode | undefined
  const { store, data } = useContext(mainContext)
  const { activeInterfaceLanguage } = useContext(languageContext)
  const [mode, setMode] = useState<'edit' | 'view'>(!term?.value ? 'edit' : 'view')
  const [search, setSearch] = useState(term.value)
  const [, startTransition] = useTransition()
  const searchInput = useRef<HTMLInputElement>(null)
  const searchResults = useRef<HTMLDivElement>(null)
  const [searchInstances, setSearchInstances] = useState<{ label: string; image?: string; iri: NamedNode }[]>()
  const cid = `iri-preview-${term.value}-${activeInterfaceLanguage}`
  const [isLoading, setIsLoading] = useState(localStorage.getItem(cid) === null)
  const source = endpoint?.value.startsWith('urn:store:') && store ? store : (endpoint?.value ?? new Store([...data]))
  const [{ label, image }, setInfo] = useState<{ image?: string; label: string }>(() => {
    const cached = localStorage.getItem(cid)
    return cached ? JSON.parse(cached) : { image: undefined, label: term.value }
  })

  useEffect(() => {
    const cached = localStorage.getItem(cid)
    if (cached) {
      setInfo(JSON.parse(cached))
    }
  }, [term.value, activeInterfaceLanguage, cid])

  const searchHandler = useDebounced(async (search: string) => {
    try {
      const items = await searcher({
        property,
        source,
        search,
        activeLanguage: activeInterfaceLanguage,
        labelPredicates,
        imagePredicates
      })
      setSearchInstances(items)
    } catch (error) {
      console.error('Error in searchHandler:', error)
    }
  })

  useEffect(() => {
    setTimeout(async () => {
      try {
        const { label, image } = await iriFetch({
          term: term as NamedNode,
          activeLanguage: activeInterfaceLanguage,
          source,
          property,
          labelPredicates,
          imagePredicates,
          cid
        })

        setInfo({ label, image })
        setIsLoading(false)
      } catch (error) {
        console.error('Error fetching IRI preview data:', error)
      }
    })
  }, [term.value, activeInterfaceLanguage])

  const apply = useCallback(
    (iri: NamedNode) => {
      setTerm(iri)
      setMode('view')
      setSearchInstances(undefined)
    },
    [setTerm, setSearchInstances, setMode]
  )

  const tryApply = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event: any) => {
      try {
        new URL(event.target?.value)
        apply(factory.namedNode(event.target.value))
      } catch {
        apply(term as NamedNode)
      }
    },
    [apply, term]
  )

  return (
    <div className="inner">
      <div className="autocomplete-input-wrapper">
        {mode === 'view' ? (
          <div className="iri-preview selected" title={term.value}>
            {isLoading ? <MemoIcon className="loading-icon" icon={'line-md:loading-loop'} /> : null}
            {image ? <Image className="image" url={image} size={32} /> : null}
            {term.value ? (
              <a href={term.value} target="_blank" rel="noopener noreferrer" className="label">
                {label}
              </a>
            ) : (
              <span className="label">No selection</span>
            )}
            <MemoIcon
              className="iconify"
              icon={editIcon}
              onClick={() => {
                setMode('edit')
                setTimeout(() => {
                  searchInput.current?.focus()
                  searchInput.current?.select()
                })
              }}
            />
          </div>
        ) : null}

        {mode === 'edit' ? (
          <input
            className="input search"
            placeholder={'Search or paste a link...'}
            value={search}
            onKeyUp={event => (['Escape', 'Enter'].includes(event.key) ? tryApply(event) : null)}
            onBlur={event => {
              setTimeout(() => tryApply(event), 200)
            }}
            ref={searchInput}
            type="search"
            onInput={event => {
              const search = (event.target as HTMLInputElement).value
              setSearch(search)
              startTransition(() => {
                searchHandler(search)
              })
            }}
          />
        ) : null}
      </div>

      {searchInstances && mode === 'edit' ? (
        <div className="search-results-wrapper" ref={searchResults}>
          <div className="search-results">
            {searchInstances.length
              ? searchInstances.map(({ iri, image, label }) => {
                  return (
                    <div key={iri.value} className="iri-preview search-result" onClick={() => apply(iri)}>
                      {image ? <Image className="image" url={image} size={32} /> : null}
                      <span className="label">{label}</span>
                    </div>
                  )
                })
              : null}
            {!searchInstances.length ? <div className="no-results">Search for something, no results found</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
