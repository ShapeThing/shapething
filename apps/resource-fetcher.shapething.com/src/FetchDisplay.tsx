import factory from "@rdfjs/data-model"
import { ResourceFetcher, type DebugEvent } from "@shapething/resource-fetcher"
import { QueryEngine } from "@comunica/query-sparql-rdfjs"

type BranchSnapshot = {
    id: string
    path: string
    type: "data" | "shape"
    depth: number
    done: false | string
    isList: boolean
    stepResults: { step: number; quadCount: number }[]
    children: BranchSnapshot[]
}
import { useSuspenseQuery } from '@tanstack/react-query'
import { Component, type ReactNode, Suspense, useContext, useRef, useState } from "react"
/** @ts-expect-error No types available */
import grapoi from "grapoi"
import datasetFactory from "@rdfjs/dataset"
import { Parser, Store } from "n3"
import { write } from "@jeswr/pretty-turtle"
import type { Quad } from "@rdfjs/types"
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import sparqlLang from 'react-syntax-highlighter/dist/esm/languages/prism/sparql'
import turtleLang from 'react-syntax-highlighter/dist/esm/languages/prism/turtle'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

SyntaxHighlighter.registerLanguage('sparql', sparqlLang)
SyntaxHighlighter.registerLanguage('turtle', turtleLang)
import { CloseAllContext } from './CloseAllContext'

const engine = new QueryEngine()

const PREFIXES: Record<string, string> = {
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    owl: "http://www.w3.org/2002/07/owl#",
    xsd: "http://www.w3.org/2001/XMLSchema#",
    sh: "http://www.w3.org/ns/shacl#",
    skos: "http://www.w3.org/2004/02/skos/core#",
    dcat: "http://www.w3.org/ns/dcat#",
    prov: "http://www.w3.org/ns/prov#",
    adms: "http://www.w3.org/ns/adms#",
    dcterms: "http://purl.org/dc/terms/",
    foaf: "http://xmlns.com/foaf/0.1/",
    schema: "https://schema.org/",
    dash: "http://datashapes.org/dash#",
    stsr: "http://ontology.shapething.com/shacl-renderer#",
    stf: "http://ontology.shapething.com/facet#",
    ex: "https://example.org/",
    skosapnl: "http://nlbegrip.nl/def/skosapnl#",
    isothes: "http://purl.org/iso25964/skos-thes#",
    wdt: "http://www.wikidata.org/prop/direct/",
    dbc: "http://dbpedia.org/resource/Category:",
    faker: "https://fakerjs.dev/",
}
type Props = {
    name: string
}

const resourceCache = new Map<string, ReturnType<typeof fetchResource>>()
function getResourcePromise(name: string) {
    if (!resourceCache.has(name)) resourceCache.set(name, fetchResource(name))
    return resourceCache.get(name)!
}

const tryToFetch = async (name: string, type: 'iri.txt' | 'input.ttl' | 'shape-iri.txt' | 'shape.ttl') =>
    fetch(`/${name}/${type}`).then(res => res.ok ? res.text() : undefined).catch(() => undefined)

async function fetchResource(name: string) {
    console.log(`Fetching resource for test "${name}"`)
    const iri = await tryToFetch(name, 'iri.txt')
    const input = await tryToFetch(name, 'input.ttl')
    const shapeIri = await tryToFetch(name, 'shape-iri.txt')
    const shapes = await tryToFetch(name, 'shape.ttl')

    if (!iri || !iri.startsWith('http')) {
        throw new Error("No IRI provided")
    }

    if (!input) {
        throw new Error("No input provided")
    }

    const inputStore = new Store(new Parser().parse(input))

    let shapesPointer: ReturnType<typeof grapoi> | undefined = undefined
    if (shapeIri && shapes && shapeIri.startsWith('http')) {
        const parser = new Parser()
        const quads = parser.parse(shapes)
        const dataset = datasetFactory.dataset()
        for (const quad of quads) {
            dataset.add(quad)
        }
        shapesPointer = grapoi({
            dataset,
            factory,
            term: factory.namedNode(shapeIri.trim()),
        })
    }

    const events: DebugEvent[] = []
    const start = performance.now()

    const resourceFetcher = new ResourceFetcher({
        resourceIri: factory.namedNode(iri.trim()),
        shapesPointer,
        sources: [inputStore],
        /** @ts-expect-error somehow the types do not match */
        engine,
        debug(event) {
            events.push(event)
        },
    })

    const { results } = await resourceFetcher.execute()
    const durationMs = Math.round(performance.now() - start)

    const turtle = await write(results as unknown as Quad[], { prefixes: PREFIXES })
    const stepCount = events.filter(e => e.type === 'step-complete').length
    const nestedStepCount = countNestedSteps(events)

    const nestedFetchTurtles: Record<string, string> = {}
    for (const event of events) {
        if (event.type === 'nested-fetch') {
            try {
                nestedFetchTurtles[event.resourceIri] = await write(event.results as unknown as Quad[], { prefixes: PREFIXES })
            } catch {
                nestedFetchTurtles[event.resourceIri] = ''
            }
        }
    }

    let shapeTurtle: string | undefined = undefined
    if (shapes && shapeIri?.startsWith('http')) {
        try {
            const parser = new Parser()
            const shapeQuads = parser.parse(shapes)
            shapeTurtle = await write(shapeQuads as unknown as Quad[], { prefixes: PREFIXES })
        } catch {
            shapeTurtle = shapes
        }
    }

    return { iri: iri.trim(), shapeIri: shapeIri?.trim(), events, durationMs, turtle, stepCount, nestedStepCount, shapeTurtle, nestedFetchTurtles }
}

function countNestedSteps(events: DebugEvent[]): number {
    let count = 0
    for (const event of events) {
        if (event.type === 'nested-fetch') {
            const nestedEvents = (event as Extract<DebugEvent, { type: 'nested-fetch' }>).events ?? []
            count += nestedEvents.filter(e => e.type === 'step-complete').length
            count += countNestedSteps(nestedEvents)
        }
    }
    return count
}

function flattenBranches(branches: BranchSnapshot[], step: number, depth = 0): { branch: BranchSnapshot; depth: number; count: number }[] {
    const rows: { branch: BranchSnapshot; depth: number; count: number }[] = []
    for (const b of branches) {
        const count = b.stepResults.find(r => r.step === step)?.quadCount ?? 0
        // Include branch if it or any descendant contributed quads at this step
        const hasDescendants = b.children.length > 0
        if (count > 0 || hasDescendants) {
            rows.push({ branch: b, depth, count })
            rows.push(...flattenBranches(b.children, step, depth + 1))
        }
    }
    return rows
}

function BranchTree({ branches, step }: { branches: BranchSnapshot[], step: number }) {
    const rows = flattenBranches(branches, step)
    if (rows.length === 0) return null
    return (
        <div className="branch-tree">
            {rows.map(({ branch: b, depth, count }) => (
                <div key={b.id} className={`branch-row branch-${b.type}`} style={{ paddingLeft: `${depth * 1.25}rem` }}>
                    <span className="branch-connector">{depth > 0 ? '↳' : '▸'}</span>
                    <span className="branch-path">{b.path}</span>
                    {count > 0 && <span className="branch-count">{count} quad{count !== 1 ? 's' : ''}</span>}
                    {b.done && b.done !== 'false' && <span className="branch-done">{b.done}</span>}
                </div>
            ))}
        </div>
    )
}

type StepGroup = {
    step: number
    query?: Extract<DebugEvent, { type: 'query' }>
    complete?: Extract<DebugEvent, { type: 'step-complete' }>
}

type FlatEvent =
    | Extract<DebugEvent, { type: 'graph-detected' }>
    | Extract<DebugEvent, { type: 'nested-fetch' }>

function groupEvents(events: DebugEvent[]): (StepGroup | FlatEvent)[] {
    const result: (StepGroup | FlatEvent)[] = []
    const stepMap = new Map<number, StepGroup>()
    for (const event of events) {
        if (event.type === 'query' || event.type === 'step-complete') {
            const step = event.step
            if (!stepMap.has(step)) {
                const group: StepGroup = { step }
                stepMap.set(step, group)
                result.push(group)
            }
            const group = stepMap.get(step)!
            if (event.type === 'query') group.query = event
            else group.complete = event
        } else {
            result.push(event as FlatEvent)
        }
    }
    return result
}

function StepGroupBlock({ group }: { group: StepGroup }) {
    const [openAt, setOpenAt] = useState(-1)
    const closeSignal = useContext(CloseAllContext)
    const open = openAt === closeSignal
    const newQuads = group.complete?.newQuads
    const summary = newQuads !== undefined
        ? `${newQuads} new quad${newQuads !== 1 ? 's' : ''}`
        : undefined
    return (
        <div className={`event event-step-group${open ? ' event-step-group--open' : ''}`}>
            <div
                className="event-header"
                role="button"
                tabIndex={0}
                aria-expanded={open}
                style={{ cursor: 'pointer' }}
                onClick={() => setOpenAt(o => o === closeSignal ? -1 : closeSignal)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenAt(o => o === closeSignal ? -1 : closeSignal) } }}
            >
                <span className="event-label">Step {group.step}</span>
                {summary && <span className="event-detail">{summary}</span>}
                <span className={`expand-arrow${open ? ' open' : ''}`} style={{ marginLeft: 'auto' }}>›</span>
            </div>
            {open && (
                <div className="step-group-body">
                    {group.query && (
                        <div className="step-group-section">
                            <span className="step-group-label">SPARQL query</span>
                            <SyntaxHighlighter language="sparql" style={vscDarkPlus} customStyle={{ margin: 0, borderRadius: '4px', fontSize: '0.78rem' }}>{group.query.query}</SyntaxHighlighter>
                        </div>
                    )}
                    {group.complete && (
                        <div className="step-group-section">
                            <span className="step-group-label">Branches</span>
                            <BranchTree branches={group.complete.branches} step={group.step} />
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function NestedFetchRow({ event, turtle }: {
    event: Extract<DebugEvent, { type: 'nested-fetch' }>
    turtle: string
}) {
    const dialogRef = useRef<HTMLDialogElement>(null)

    return (
        <div className="event event-nested">
            <div
                className="event-header"
                role="button"
                tabIndex={0}
                aria-haspopup="dialog"
                style={{ cursor: 'pointer' }}
                onClick={() => dialogRef.current?.showModal()}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dialogRef.current?.showModal() } }}
            >
                <span className="event-label">Nested fetch</span>
                <span className="event-detail">{event.resourceIri}</span>
                <span className="expand-arrow" style={{ marginLeft: 'auto' }}>›</span>
            </div>
            <dialog
                ref={dialogRef}
                className="nested-fetch-modal"
                onClick={e => { if (e.target === dialogRef.current) dialogRef.current!.close() }}
            >
                <div className="nested-fetch-modal-content">
                    <div className="nested-fetch-modal-header">
                        <h3>Nested fetch</h3>
                        <button className="modal-close" onClick={() => dialogRef.current?.close()} aria-label="Close">✕</button>
                    </div>
                    <div className="test-details">
                        <div className="detail-section">
                            <h4>Input IRI</h4>
                            <code className="iri-display">{event.resourceIri}</code>
                        </div>
                        <div className="detail-section">
                            <h4>Algorithm steps</h4>
                            <div className="steps-list">
                                {groupEvents(event.events ?? []).map((item, i) => {
                                    if ('step' in item) return <StepGroupBlock key={i} group={item} />
                                    const e = item as FlatEvent
                                    if (e.type === 'graph-detected') return <CollapsibleEvent key={i} className="event-graph" label="Graph detected" summary={e.graph ?? 'default graph'} />
                                    if (e.type === 'nested-fetch') return <NestedFetchRow key={i} event={e} turtle="" />
                                    return null
                                })}
                            </div>
                        </div>
                        <div className="detail-section">
                            <h4>Results</h4>
                            <SyntaxHighlighter language="turtle" style={vscDarkPlus} customStyle={{ margin: 0, borderRadius: '5px', fontSize: '0.8rem' }}>{turtle}</SyntaxHighlighter>
                        </div>
                    </div>
                </div>
            </dialog>
        </div>
    )
}

function CollapsibleEvent({ label, summary, children, className }: {
    label: string
    summary?: string
    children?: ReactNode
    className: string
}) {
    const [openAt, setOpenAt] = useState(-1)
    const closeSignal = useContext(CloseAllContext)
    const open = openAt === closeSignal
    return (
        <div className={`event ${className}`}>
            <div
                className="event-header"
                role={children ? 'button' : undefined}
                tabIndex={children ? 0 : undefined}
                aria-expanded={children ? open : undefined}
                onClick={children ? () => setOpenAt(o => o === closeSignal ? -1 : closeSignal) : undefined}
                onKeyDown={children ? (e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenAt(o => o === closeSignal ? -1 : closeSignal) } }) : undefined}
                style={children ? { cursor: 'pointer' } : undefined}
            >
                <span className="event-label">{label}</span>
                {summary && <span className="event-detail">{summary}</span>}
                {children && <span className={`expand-arrow${open ? ' open' : ''}`} style={{ marginLeft: 'auto' }}>{open ? '▲' : '▼'}</span>}
            </div>
            {open && children}
        </div>
    )
}

function Inner({ name }: Props) {
    const [openAt, setOpenAt] = useState(-1)
    const closeSignal = useContext(CloseAllContext)
    const expanded = openAt === closeSignal

    const { data: { iri, shapeIri, events, durationMs, turtle, stepCount, nestedStepCount, shapeTurtle, nestedFetchTurtles } } = useSuspenseQuery({
        queryKey: ["fetchResource", name],
        queryFn: () => getResourcePromise(name),
    })

    const label = name.replace(/-/g, ' ')

    return (
        <div className="test-row">
            <div
                className="test-summary"
                role="button"
                tabIndex={0}
                aria-expanded={expanded}
                onClick={() => setOpenAt(o => o === closeSignal ? -1 : closeSignal)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenAt(o => o === closeSignal ? -1 : closeSignal) } }}
            >
                <span className="status-icon pass" aria-hidden="true">✓</span>
                <span className="test-name">{label}</span>
                <span className="test-meta">{stepCount} {stepCount === 1 ? 'step' : 'steps'}{nestedStepCount > 0 ? ` and ${nestedStepCount} nested ${nestedStepCount === 1 ? 'step' : 'steps'}` : ''}</span>
                <span className="test-timing">({durationMs}ms on an in-memory dataset)</span>
                <span className={`expand-arrow${expanded ? ' open' : ''}`} aria-hidden="true">›</span>
            </div>
            {expanded && (
                <div className="test-details">
                    <div className="detail-section">
                        <h4>Input IRI</h4>
                        <code className="iri-display">{iri}</code>
                    </div>
                    {shapeTurtle && (
                        <div className="detail-section">
                            <h4>Input shape{shapeIri && <span className="section-subtitle"> — {shapeIri}</span>}</h4>
                            <SyntaxHighlighter language="turtle" style={vscDarkPlus} customStyle={{ margin: 0, borderRadius: '5px', fontSize: '0.8rem' }}>{shapeTurtle}</SyntaxHighlighter>
                        </div>
                    )}
                    <div className="detail-section">
                        <h4>Algorithm steps</h4>
                        <div className="steps-list">
                            {groupEvents(events).map((item, i) => {
                                if ('step' in item) {
                                    return <StepGroupBlock key={i} group={item} />
                                }
                                const event = item as FlatEvent
                                if (event.type === 'graph-detected') {
                                    return (
                                        <CollapsibleEvent key={i} className="event-graph" label="Graph detected" summary={event.graph ?? 'default graph'} />
                                    )
                                }
                                if (event.type === 'nested-fetch') {
                                    return (
                                        <NestedFetchRow key={i} event={event} turtle={nestedFetchTurtles[event.resourceIri] ?? ''} />
                                    )
                                }
                                return null
                            })}
                        </div>
                    </div>
                    <div className="detail-section">
                        <h4>Results</h4>
                        <SyntaxHighlighter language="turtle" style={vscDarkPlus} customStyle={{ margin: 0, borderRadius: '5px', fontSize: '0.8rem' }}>{turtle}</SyntaxHighlighter>
                    </div>
                </div>
            )}
        </div>
    )
}

// --- Error boundary ---

type EBState = { error: Error | null }

class ErrorBoundary extends Component<{ name: string; children: ReactNode }, EBState> {
    constructor(props: { name: string; children: ReactNode }) {
        super(props)
        this.state = { error: null }
    }

    static getDerivedStateFromError(error: Error): EBState {
        return { error }
    }

    render() {
        const { error } = this.state
        if (error) return <ErrorRow name={this.props.name} error={error} />
        return this.props.children
    }
}

function ErrorRow({ name, error }: { name: string; error: Error }) {
    const [openAt, setOpenAt] = useState(-1)
    const closeSignal = useContext(CloseAllContext)
    const expanded = openAt === closeSignal
    const label = name.replace(/-/g, ' ')
    return (
        <div className="test-row">
            <div
                className="test-summary"
                role="button"
                tabIndex={0}
                aria-expanded={expanded}
                onClick={() => setOpenAt(o => o === closeSignal ? -1 : closeSignal)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenAt(o => o === closeSignal ? -1 : closeSignal) } }}
            >
                <span className="status-icon fail" aria-hidden="true">✗</span>
                <span className="test-name">{label}</span>
                <span className="test-meta error-msg">{error.message}</span>
                <span className={`expand-arrow${expanded ? ' open' : ''}`} aria-hidden="true">›</span>
            </div>
            {expanded && (
                <div className="test-details">
                    <pre className="error-detail">{error.stack ?? error.message}</pre>
                </div>
            )}
        </div>
    )
}

// --- Public component ---

export default function FetchDisplay({ name }: Props) {
    return (
        <ErrorBoundary name={name}>
            <Suspense fallback={
                <div className="test-row loading">
                    <div className="test-summary">
                        <span className="status-icon loading-spinner" />
                        <span className="test-name">{name.replace(/-/g, ' ')}</span>
                        <span className="test-meta">running…</span>
                    </div>
                </div>
            }>
                <Inner name={name} />
            </Suspense>
        </ErrorBoundary>
    )
}
