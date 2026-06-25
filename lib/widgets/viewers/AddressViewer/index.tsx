import { useContext } from 'react'
import { languageContext } from '../../../core/language-context'
import { schema } from '../../../core/namespaces'
import { language } from '../../../helpers/language'
import { WidgetProps } from '../../widgets-context'

export default function AddressViewer({ term, nodeDataPointer }: WidgetProps) {
  const { activeInterfaceLanguage } = useContext(languageContext)

  const pointer = nodeDataPointer.node(term)
  const street = pointer.out(schema('streetAddress')).best(language([activeInterfaceLanguage, '', '*'])).value
  const locality = pointer.out(schema('addressLocality')).best(language([activeInterfaceLanguage, '', '*'])).value
  const region = pointer.out(schema('addressRegion')).best(language([activeInterfaceLanguage, '', '*'])).value
  const postalCode = pointer.out(schema('postalCode')).best(language([activeInterfaceLanguage, '', '*'])).value
  const country = pointer.out(schema('addressCountry')).best(language([activeInterfaceLanguage, '', '*'])).value

  return (
    <>
      {street}
      <br />
      {postalCode} {locality}
      <br />
      {region} {country}
    </>
  )
}
