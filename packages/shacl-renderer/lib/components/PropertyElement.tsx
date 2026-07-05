import { Localized } from '@fluent/react'

import { Fragment, ReactNode, useContext } from 'react'
import { languageContext } from '../core/language-context'
import { mainContext } from '../core/main-context'
import { rdf, rdfs, sh } from '../core/namespaces'
import Grapoi from '../Grapoi'
import { languageIcon } from '../helpers/icons'
import { language } from '../helpers/language'
import parsePath from '../helpers/parsePath'
import { MemoIcon } from './various/Icon'

type PropertyElementProps = {
  property?: Grapoi
  label?: string | ReactNode
  children: ReactNode
  showColon?: true
  cssClass?: string
  description?: ReactNode
  suffix?: ReactNode
  required?: true
}

export default function PropertyElement({
  children,
  cssClass,
  property,
  showColon,
  suffix,
  required,
  description,
  label: givenLabel
}: PropertyElementProps) {
  const { mode, dereferenceCommentsAsDescriptions } = useContext(mainContext)
  const { activeInterfaceLanguage } = useContext(languageContext)

  const path = property ? parsePath(property?.out(sh('path'))) : undefined
  const predicate = path ? path[0]?.predicates[0] : undefined

  const labelViaDereferencing =
    property && dereferenceCommentsAsDescriptions
      ? property
          .node(predicate ?? property.out(sh('path')).term)
          .out(rdfs('label'))
          .best(language([activeInterfaceLanguage, '', '*'])).value
      : undefined

  const label =
    givenLabel ??
    property?.out([sh('name'), rdfs('label')]).best(language([activeInterfaceLanguage, '', '*']))?.value ??
    labelViaDereferencing ??
    property?.out(sh('path')).value?.split(/#|\//g).pop()

  const descriptionViaDereferencing =
    property && dereferenceCommentsAsDescriptions
      ? property
          .node(predicate ?? property.out(sh('path')).term)
          .out(rdfs('comment'))
          .best(language([activeInterfaceLanguage, '', '*']))
      : undefined
  const descriptionViaProperty = property?.out(sh('description')).best(language([activeInterfaceLanguage, '', '*']))

  const descriptionLines = [
    ...(descriptionViaProperty?.values ?? []),
    ...(descriptionViaDereferencing?.values ?? [])
  ][0]?.split('\n')

  const minCount = property?.out(sh('minCount')).value ? parseInt(property?.out(sh('minCount')).value) : undefined
  const optional = required ? false : !((minCount ?? 0) > 0)
  const uniqueLang = property?.out(sh('uniqueLang')).term?.value === 'true'
  const isLanguageDataType = property?.out(sh('datatype')).term?.equals(rdf('langString'))

  return (
    <div className={`property ${cssClass ?? ''}`.trim()} data-term={property?.values.join(':')}>
      <label className="label" title={predicate?.value}>
        {label}
        {showColon ? ': ' : ''}
        {mode === 'edit' && (uniqueLang || isLanguageDataType) ? (
          <MemoIcon className="multilingual" icon={languageIcon} />
        ) : null}
        {mode === 'edit' && optional ? (
          <em className="optional">
            (<Localized id="optional">optional</Localized>)
          </em>
        ) : null}
      </label>
      {description ? <span className="field-description">{description}</span> : null}
      {mode === 'edit' && descriptionLines?.length ? (
        <span className="field-description">
          {descriptionLines.map(line => (
            <Fragment key={line}>
              {line}
              <br />
            </Fragment>
          ))}
        </span>
      ) : null}
      {children}
      {suffix}
    </div>
  )
}
