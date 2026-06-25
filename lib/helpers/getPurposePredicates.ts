import { NamedNode } from '@rdfjs/types'
import { dbo, dce, dct, foaf, og, rdfs, schema, sdo, sh, stsr } from '../core/namespaces'
import Grapoi from '../Grapoi'
import parsePath from './parsePath'

export const getPurposePredicates = (purpose: 'label' | 'image', nodeShape?: Grapoi) => {
  const purposeProperty = nodeShape?.out(sh('property')).hasOut(stsr('purpose'), stsr(purpose))
  const path = purposeProperty ? parsePath(purposeProperty.out(sh('path'))) : undefined

  const rawPredicates =
    path?.[0]?.predicates ??
    (purpose === 'label'
      ? [rdfs('label'), schema('name'), sdo('name'), dct('title'), dce('title'), og('title')]
      : [dbo('thumbnail'), schema('image'), sdo('image'), foaf('depiction'), foaf('img'), og('image')])

  const predicates: NamedNode[] = rawPredicates.filter((p): p is NamedNode => p.termType === 'NamedNode')
  return predicates
}
