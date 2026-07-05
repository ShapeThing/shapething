import { useRef } from 'react'
import Grapoi from '../Grapoi'
import { sortPointersStable } from '../helpers/sortPointersStable'

export const useStable = (items: Grapoi) => {
  const cache = useRef(items.terms)
  if (cache) sortPointersStable(items, cache.current)
  cache.current = items.terms
  return items
}
