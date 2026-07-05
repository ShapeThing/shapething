import Grapoi from '../Grapoi'

export const mergePointers = (pointers: Grapoi[], pointer: Grapoi): Grapoi => {
  const newPointer = pointer.clone({ ptrs: [] })
  newPointer.ptrs = pointers.flatMap(pointer => pointer.ptrs)
  return newPointer
}
