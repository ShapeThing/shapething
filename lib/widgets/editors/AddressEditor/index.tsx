import { Localized } from '@fluent/react'
import factory from '@rdfjs/data-model'
import { useDebounce } from '@uidotdev/usehooks'
import { useContext, useEffect, useRef, useState } from 'react'
import { MemoIcon } from '../../../components/various/Icon'
import { languageContext } from '../../../core/language-context'
import { schema, stsr } from '../../../core/namespaces'
import { dismissIcon, editIcon } from '../../../helpers/icons'
import { language } from '../../../helpers/language'
import { WidgetProps } from '../../widgets-context'
import { OsmAddress } from './types'

const searchUrl = (search: string, countries: string[]) =>
  `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(search)}&format=json&addressdetails=1&countrycodes=${countries.join(',')}`

export default function AddressEditor({ term, property, nodeDataPointer }: WidgetProps) {
  const [search, setSearch] = useState<string>('')
  const [results, setResults] = useState<OsmAddress[]>([])
  const countries = property.out(stsr('osmCountries')).values ?? ['nl']
  const debouncedSearch = useDebounce(search, 300)
  const { activeInterfaceLanguage } = useContext(languageContext)
  const [editing, setEditing] = useState(false)

  const pointer = nodeDataPointer.node(term)
  const street = pointer.out(schema('streetAddress')).best(language([activeInterfaceLanguage, '', '*'])).value
  const locality = pointer.out(schema('addressLocality')).best(language([activeInterfaceLanguage, '', '*'])).value
  const region = pointer.out(schema('addressRegion')).best(language([activeInterfaceLanguage, '', '*'])).value
  const postalCode = pointer.out(schema('postalCode')).best(language([activeInterfaceLanguage, '', '*'])).value
  const country = pointer.out(schema('addressCountry')).best(language([activeInterfaceLanguage, '', '*'])).value

  useEffect(() => {
    if (!debouncedSearch) return setResults([])
    ;(async () => {
      const response = await fetch(searchUrl(debouncedSearch, countries))
      const data = await response.json()
      setResults(data)
    })()
  }, [debouncedSearch])

  const searchRef = useRef<HTMLInputElement>(null)

  const setValue = ({ road, house_number, postcode, city, state, country }: OsmAddress['address']) => {
    pointer.deleteOut(schema('streetAddress'))
    pointer.deleteOut(schema('addressLocality'))
    pointer.deleteOut(schema('addressRegion'))
    pointer.deleteOut(schema('postalCode'))
    pointer.deleteOut(schema('addressCountry'))

    pointer.addOut(schema('streetAddress'), factory.literal(`${road} ${house_number}`))
    pointer.addOut(schema('addressLocality'), factory.literal(city))
    pointer.addOut(schema('addressRegion'), factory.literal(state))
    pointer.addOut(schema('postalCode'), factory.literal(postcode))
    pointer.addOut(schema('addressCountry'), factory.literal(country))

    setSearch('')
    setResults([])
    setEditing(false)
  }

  return (
    <div className="inner">
      {editing ? (
        <>
          <label className="label">
            <Localized id="search-for-address">Search for an address</Localized>
          </label>
          <div className="input-wrapper">
            <input ref={searchRef} className="input" value={search} onChange={event => setSearch(event.target.value)} />
            <MemoIcon
              tabIndex={0}
              className="edit-icon"
              icon={dismissIcon}
              onClick={() => {
                setSearch('')
                setResults([])
                setEditing(false)
              }}
            />
          </div>

          {results.length > 0 ? (
            <div className="geocode-results">
              {results.slice(0, 10).map(result => {
                const { road, house_number, postcode, city, state, country } = result.address

                const lines = [
                  `${road ?? ''} ${house_number ?? ''}`,
                  `${postcode ?? ''} ${city ?? ''}`,
                  `${state ?? ''} ${country ?? ''}`
                ].filter(item => item.trim())

                return (
                  <div key={result.osm_id} className="geocode-result" onClick={() => setValue(result.address)}>
                    {lines.map(line => {
                      return (
                        <>
                          {line}
                          <br />
                        </>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          ) : null}
        </>
      ) : (
        <div className="input">
          <div className="current-value">
            {street}
            <br />
            {postalCode} {locality}
            <br />
            {region} {country}
          </div>
          <MemoIcon
            tabIndex={0}
            className="edit-icon"
            icon={editIcon}
            onClick={() => {
              setEditing(true)
              setTimeout(() => {
                searchRef.current?.focus()
              }, 100)
            }}
          />
        </div>
      )}
    </div>
  )
}
