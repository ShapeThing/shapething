import TermSet from '@rdfjs/term-set'
import { useContext } from 'react'
import { languageContext } from '../../../core/language-context'
import { sh } from '../../../core/namespaces'
import Grapoi from '../../../Grapoi'
import { language } from '../../../helpers/language'
import parsePath from '../../../helpers/parsePath'
import { sortShaclItems } from '../../../helpers/sortShaclItems'
import { WidgetProps } from '../../widgets-context'

export default function ValueTableViewer({ property, quads, nodeDataPointer }: WidgetProps) {
  const { activeInterfaceLanguage } = useContext(languageContext)

  const headerPointers = property
    .out(sh('node'))
    .out(sh('property'))
    .map((pointer: Grapoi) => pointer)
    .sort(sortShaclItems)

  const headers = headerPointers.map(
    (pointer: Grapoi) => pointer.out(sh('name')).best(language([activeInterfaceLanguage, '', '*'])).value
  )

  const subjects = new TermSet(quads.map(quad => quad.object))

  const rows = [...subjects.values()].map(subject => {
    const pointer = nodeDataPointer.node(subject)
    const row = []

    for (const headerPointer of headerPointers) {
      const path = parsePath(headerPointer.out(sh('path')))
      row.push(path ? pointer.executeAll(path).best(language([activeInterfaceLanguage, '', '*'])).value : '')
    }
    return {
      subject,
      row
    }
  })

  return (
    <table>
      <thead>
        <tr>
          {headers.map(header => (
            <th key={header}>{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(({ row, subject }) => (
          <tr key={subject.value}>
            {row.map(cell => (
              <td key={cell}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
