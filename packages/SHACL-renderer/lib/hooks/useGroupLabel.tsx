import { useContext, useMemo } from 'react'
import { languageContext } from '../core/language-context'
import { rdfs, sh, stsr } from '../core/namespaces'
import Grapoi from '../Grapoi'
import { language } from '../helpers/language'
import { nonNullable } from '../helpers/nonNullable'

/**
 * A label can come from the property or the data.
 * If it comes from the data it has been set with stsr:groupLabelPath.
 */
export const useGroupLabel = (group: Grapoi, nodeDataPointer?: Grapoi) => {
  const { activeInterfaceLanguage, activeContentLanguage } = useContext(languageContext)

  const label = useMemo(() => {
    const groupLabelPaths = group.out(stsr('groupLabelPath'))
    const label = group.out([sh('name'), rdfs('label')]).best(language([activeInterfaceLanguage, '', '*'])).value
    let dynamicLabels: string[] = []

    if (groupLabelPaths.ptrs.length && nodeDataPointer) {
      dynamicLabels = groupLabelPaths
        .map((groupLabelPath: Grapoi) => {
          const groupLabelPathPointers: Grapoi[] = [...groupLabelPath.list()]

          const hasMultipleLanguages =
            groupLabelPathPointers
              .map(pointer => (pointer.term.termType === 'Literal' ? pointer.term.language : undefined))
              .filter(nonNullable).length > 1

          return groupLabelPathPointers
            .map(pointer => {
              if (pointer.term.termType === 'Literal') {
                if (hasMultipleLanguages && pointer.term.language === activeInterfaceLanguage) return pointer.term.value
                if (!hasMultipleLanguages) return pointer.term.value
                return ''
              }
              return nodeDataPointer.out(pointer.term).best(language([activeContentLanguage, '', '*', 'localName']))
                .value
            })
            .join('')
        })
        .filter(Boolean)
    }
    return label ?? dynamicLabels?.[0]
  }, [group, nodeDataPointer, activeInterfaceLanguage, activeContentLanguage])

  return label
}
