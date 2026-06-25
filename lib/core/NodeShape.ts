import factory from '@rdfjs/data-model'
import datasetFactory from '@rdfjs/dataset'
import TermSet from '@rdfjs/term-set'
import type { DatasetCore, Quad_Object, Quad_Predicate, Quad_Subject, Term } from '@rdfjs/types'
import grapoi from 'grapoi'
import once from 'lodash-es/once.js'
import Grapoi from '../Grapoi'
import { nonNullable } from '../helpers/nonNullable'
import parsePath from '../helpers/parsePath'
import { Path } from '../Path'
import { sh } from './namespaces'

type ShapeOptions = {
  dataSubjects?: Quad_Subject[]
  dataGraph?: DatasetCore
  shapeSubjects?: Quad_Subject[]
  shapesGraph?: DatasetCore
  parentShape?: Shape
}

type PropertyShapeOptions = ShapeOptions & {
  setDataSubjects?: true
  parentType: ParentType
}

type ParentType = 'property' | 'or' | 'not' | 'xone' | 'and' | 'node' | 'data' | 'group' | 'node-variant'

type NodeShapeOptions = ShapeOptions & {
  parentType?: ParentType
}

type GroupShapeOptions = ShapeOptions & {
  parentType: ParentType
}

const orderShapes = (a: Shape, b: Shape) => {
  const aOrder = parseFloat(a.get(sh('order')).term?.value ?? '0')
  const bOrder = parseFloat(b.get(sh('order')).term?.value ?? '0')

  if (aOrder === bOrder) {
    return a.shapesPointer.value.localeCompare(b.shapesPointer.value)
  }

  return aOrder - bOrder
}
/**
 * A base class for SHACL shapes.
 */
export abstract class Shape {
  public shapesPointer: Grapoi
  public dataPointer: Grapoi
  public properties: () => PropertyShape[]
  public elements: () => (PropertyShape | GroupShape)[]
  public groups: () => GroupShape[]
  public parentShape?: Shape
  public get: (predicate: Quad_Predicate | Quad_Predicate[]) => Grapoi
  public abstract type: 'property' | 'node' | 'group'

  constructor({ shapesGraph, shapeSubjects = [], dataGraph, dataSubjects = [], parentShape }: ShapeOptions) {
    this.shapesPointer = grapoi({
      factory,
      dataset: shapesGraph ?? datasetFactory.dataset(),
      terms: shapeSubjects
    }) as unknown as Grapoi
    this.dataPointer = grapoi({
      factory,
      dataset: dataGraph ?? datasetFactory.dataset(),
      terms: dataSubjects
    }) as unknown as Grapoi
    this.parentShape = parentShape

    this.get = (predicate: Quad_Predicate | Quad_Predicate[]) => this.shapesPointer.out(predicate) as Grapoi

    // sh:property, logical constraints, predicates from the data
    this.properties = once(() => {
      const ignoreProperties = this.get(sh('ignoredProperties')).isList()
        ? [...this.get(sh('ignoredProperties')).list()].map((pointer: Grapoi) => pointer.term)
        : []

      const properties = [...this.get([sh('property')])]
        .map((propertyPointer: Grapoi) => {
          return new PropertyShape({
            parentType: this.type,
            parentShape: this,
            shapesGraph,
            shapeSubjects: [propertyPointer.term as Quad_Subject],
            dataGraph,
            dataSubjects,
            setDataSubjects: true
          })
        })
        .filter(nonNullable)

      const logicalConstraints = this.get([sh('or'), sh('not'), sh('xone'), sh('and')])
        .filter((pointer: Grapoi) => pointer.isList())
        .map((listPointer: Grapoi) => {
          const items: Grapoi[] = [...listPointer.list()]

          return items
            .filter((pointer: Grapoi) => pointer.hasOut(sh('path')).term)
            .map((pointer: Grapoi) => {
              const glueQuad = [...listPointer.quads()].at(-1)
              const parentType = glueQuad?.predicate.value.split('#')[1] as ParentType

              return new PropertyShape({
                parentType,
                parentShape: this,
                shapesGraph,
                shapeSubjects: [pointer.term as Quad_Subject],
                dataGraph,
                dataSubjects,
                setDataSubjects: true
              })
            })
        })
        .flat()

      const knownProperties = [...properties, ...logicalConstraints]
      const knownPredicates = knownProperties.flatMap(p => p.path().at(-1)?.predicates ?? [])

      const unknownPredicates = new TermSet(
        [...this.dataPointer.out().quads()]
          .map(quad => quad.predicate)
          .filter(unknownPredicate => !knownPredicates.some(knownPredicate => unknownPredicate.equals(knownPredicate)))
      )

      const unknownProperties = [...unknownPredicates.values()].map((predicate: Quad_Predicate) => {
        // Unknown predicates are not part of the shapes graph, so we create a new dataset for them
        // With this we can render forms and show unknown properties
        const propertyDataset = datasetFactory.dataset()
        const subject = factory.blankNode()
        propertyDataset.add(factory.quad(subject, sh('path'), predicate))

        return new PropertyShape({
          parentType: 'data',
          parentShape: this,
          shapesGraph: propertyDataset,
          shapeSubjects: [subject],
          dataGraph,
          dataSubjects: this.dataPointer.out(predicate).terms as Quad_Subject[]
        })
      })

      const nodes = this.get([sh('node')]).map(
        (nodePointer: Grapoi) =>
          new NodeShape({
            parentType: 'node',
            parentShape: this,
            shapesGraph,
            shapeSubjects: [nodePointer.term as Quad_Subject],
            dataGraph,
            dataSubjects
          })
      )

      const nodeProperties = nodes.flatMap(node => node.properties())

      return [...unknownProperties, ...knownProperties, ...nodeProperties]
        .filter(
          property =>
            !ignoreProperties.some(ignored =>
              property
                .path()
                .at(-1)
                .predicates.some((predicate: Term) => ignored.equals(predicate))
            )
        )
        .toSorted(orderShapes)
    })

    // The groups attached to the properties in the properties and nodes.
    // These groups are always scoped to the node shape(s).
    this.groups = once(() => {
      const topLevelGroupIRIs = new TermSet(
        this.properties()
          .map(property => property.get(sh('group')).term)
          .map(groupIRI => {
            if (!groupIRI) return

            let topLevelGroup = groupIRI
            let pointer = this.shapesPointer.node(groupIRI)
            while (pointer.out(sh('group')).term) {
              topLevelGroup = pointer.term
              pointer = pointer.node(pointer.out(sh('group')).term)
            }

            return topLevelGroup
          })
          .filter(nonNullable)
      )

      return [...topLevelGroupIRIs.values()].map(groupIRI => {
        return new GroupShape({
          parentType: this.type,
          parentShape: this,
          shapesGraph,
          shapeSubjects: [groupIRI as Quad_Subject],
          dataGraph,
          dataSubjects
        })
      })
    })

    // The elements of the shape, which are either properties or groups.
    // These elements are scoped to the node shape(s) and the groups.
    this.elements = once(() => {
      const validProperties = this.properties().filter(property => {
        const groupTerm = property.get(sh('group')).term
        return this.type === 'group' ? groupTerm.equals(this.shapesPointer.term) : !groupTerm
      })
      return [...validProperties, ...this.groups()].toSorted(orderShapes)
    })
  }

  debug(type: 'elements' | 'properties' = 'elements', depth = 0): string {
    return this[type]()
      .map(element => {
        const label = element.get(sh('name')).values?.[0] ?? element.shapesPointer.value.split(/#|\//).pop()
        return `${' '.repeat(depth * 2)}${element.type}: ${label}\n${element.debug(type, depth + 1)}`
      })
      .join('')
  }
}
/**
 * A shape is a representation of a SHACL shape.
 */
export class NodeShape extends Shape {
  readonly parentType?: ParentType
  public type = 'node' as const
  public variants: () => NodeShape[][]

  constructor(options: NodeShapeOptions) {
    super(options)
    const { shapesGraph, dataGraph, dataSubjects = [], parentType } = options
    this.parentType = parentType

    this.variants = once(() => {
      const variantNodes = this.get([sh('or'), sh('not'), sh('xone'), sh('and')])
        .filter((pointer: Grapoi) => pointer.isList())
        .map((listPointer: Grapoi) => {
          const glueQuad = [...listPointer.quads()].at(-1)
          const parentType = glueQuad?.predicate.value.split('#')[1] as ParentType

          const items: Grapoi[] = [...listPointer.list()]

          return items
            .filter((pointer: Grapoi) => !pointer.hasOut(sh('path')).term)
            .map((pointer: Grapoi) => {
              return new NodeShape({
                parentType,
                parentShape: this,
                shapesGraph,
                shapeSubjects: [pointer.term as Quad_Subject],
                dataGraph,
                dataSubjects
              })
            })
        })
      return variantNodes
    })
  }
}

/**
 * The property shape is a representation of a SHACL property shape.
 * It contains the path to the property and the objects that match the path.
 */
export class PropertyShape extends Shape {
  readonly parentType: ParentType
  public type = 'property' as const

  readonly path: () => Path
  readonly objects: () => Quad_Object[]
  readonly variants: () => PropertyShape[]

  constructor(options: PropertyShapeOptions) {
    super(options)
    const { parentType, shapesGraph, shapeSubjects, dataGraph, dataSubjects } = options
    this.parentType = parentType

    this.path = once(() => parsePath(this.get(sh('path')))) as () => Path
    this.objects = () => this.dataPointer.terms.toSorted((a, b) => a.value.localeCompare(b.value)) as Quad_Subject[]
    this.variants = () => {
      // A variant itself can not have variants.
      if (this.shapesPointer.terms.length > 1) return []

      return this.get([sh('or'), sh('not'), sh('xone'), sh('and')])
        .filter((pointer: Grapoi) => pointer.isList())
        .map((listPointer: Grapoi) => {
          const items: Grapoi[] = [...listPointer.list()]

          return items.map(item => {
            return new PropertyShape({
              parentType: item.term.value.split('#')[1] as ParentType,
              parentShape: this,
              shapesGraph,
              shapeSubjects: [...(shapeSubjects ?? []), item.term as Quad_Subject],
              dataGraph,
              dataSubjects
            })
          })
        })
        .flat()
    }

    if (options.setDataSubjects && options.dataSubjects?.length) {
      this.dataPointer = this.dataPointer.executeAll(this.path())
    }
  }
}

/**
 * A group shape is a representation of a SHACL group shape.
 * It contains properties and other group shapes that are part of the group.
 * Groups can be nested, and they are always scoped to the node shape(s).
 * Groups can also be nested within other groups.
 * The group shape is used to group properties and other groups together.
 */
export class GroupShape extends Shape {
  readonly parentType: ParentType
  public type = 'group' as const

  constructor(options: GroupShapeOptions) {
    const { shapesGraph, shapeSubjects = [], dataGraph, dataSubjects = [], parentType } = options
    if (shapeSubjects.filter(nonNullable)?.length !== 1) {
      throw new Error('Groups must be initiated with a groupIRI')
    }
    super(options)
    this.parentType = parentType

    this.properties = once(() => {
      return (this.parentShape?.properties() ?? []).filter(property =>
        property.get(sh('group')).term?.equals(this.shapesPointer.term)
      )
    })

    this.groups = once(() => {
      const nestedGroupIRIs = new TermSet(
        this.properties()
          .map(property => property.get(sh('group')).term)
          .map(groupIRI => {
            if (!groupIRI) return

            let nestedGroupIRI = groupIRI
            let pointer = this.shapesPointer.node(groupIRI)
            while (pointer.out(sh('group')).term) {
              if (pointer.term.equals(this.shapesPointer.term)) break
              nestedGroupIRI = pointer.term
              pointer = pointer.node(pointer.out(sh('group')).term)
            }

            return nestedGroupIRI
          })
          .filter(nonNullable)
      )

      nestedGroupIRIs.delete(this.shapesPointer.term)

      return [...nestedGroupIRIs.values()].map(groupIRI => {
        return new GroupShape({
          parentType: this.type,
          parentShape: this,
          shapesGraph,
          shapeSubjects: [groupIRI as Quad_Subject],
          dataGraph,
          dataSubjects
        })
      })
    })
  }
}
