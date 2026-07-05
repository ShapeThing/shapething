import type { Quad_Predicate, Quad_Subject } from '@rdfjs/types'

export class Rerenderer {
  #cache: Map<string, Map<string, () => void>>

  constructor() {
    this.#cache = new Map()
  }

  render(subject: Quad_Subject, predicate: Quad_Predicate) {
    const predicatesCache = this.#cache.get(subject.value)
    predicatesCache?.get(predicate.value)?.()
  }

  register(subject: Quad_Subject, predicate: Quad_Predicate, callback: () => void) {
    if (!this.#cache.has(subject.value)) this.#cache.set(subject.value, new Map())
    const predicatesCache = this.#cache.get(subject.value)!
    predicatesCache.set(predicate.value, callback)
  }
}
