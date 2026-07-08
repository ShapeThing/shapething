import { rdf } from "../core/namespaces"
import Grapoi from "../Grapoi"

export const listRoot = (pointer: Grapoi): Grapoi => {
    const previous = pointer.in(rdf('rest'))
    return previous.term ? listRoot(previous) : pointer
}
