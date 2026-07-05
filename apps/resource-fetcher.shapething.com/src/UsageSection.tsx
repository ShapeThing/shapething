import { useState } from "react"
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter"
import tsLang from "react-syntax-highlighter/dist/esm/languages/prism/typescript"
import turtleLang from "react-syntax-highlighter/dist/esm/languages/prism/turtle"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"

SyntaxHighlighter.registerLanguage("typescript", tsLang)
SyntaxHighlighter.registerLanguage("turtle", turtleLang)

const INSTALL_CMD = "npx jsr add @shapething/resource-fetcher"

function InstallBlock() {
    const [copied, setCopied] = useState(false)

    const copy = () => {
        navigator.clipboard.writeText(INSTALL_CMD).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }

    return (
        <div className="install-block">
            <span className="install-prompt">$</span>
            <code className="install-cmd">{INSTALL_CMD}</code>
            <button className="install-copy" onClick={copy} aria-label="Copy install command">
                {copied
                    ? <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg>
                }
                <span className="install-copy-label">{copied ? "Copied!" : "Copy"}</span>
            </button>
        </div>
    )
}

const SHAPE_TURTLE = `\
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix ex:   <https://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .

ex:PersonShape
    a sh:NodeShape ;
    sh:targetClass foaf:Person ;
    sh:property [
        sh:path foaf:name ;
        sh:datatype xsd:string ;
        sh:maxCount 1 ;
    ] ;
    sh:property [
        sh:path foaf:knows ;
        sh:class foaf:Person ;
        sh:node ex:PersonShape ;
    ] .
`

const USAGE_TS = `\
import { ResourceFetcher } from "@shapething/resource-fetcher"
import factory from "@rdfjs/data-model"

// --- Fetch the resource ---
const resourceFetcher = new ResourceFetcher({
    resourceIri: factory.namedNode("https://example.org/alice"),
    sources: ['http://example.com/sparql'],
    shapes: { type: 'file', value: './shape.ttl' },
    engine,
})

const { results } = await resourceFetcher.execute()
// results is a Set of RDF/JS Quad objects
console.log(\`Fetched \${results.size} quads\`)
`

type Tab = { id: string; label: string; language: string; code: string }

const TABS: Tab[] = [
    { id: "ts", label: "usage.ts", language: "typescript", code: USAGE_TS },
    { id: "shape", label: "shape.ttl (optional)", language: "turtle", code: SHAPE_TURTLE },
]

export default function UsageSection() {
    const [active, setActive] = useState("ts")
    const tab = TABS.find(t => t.id === active)!

    return (
        <section className="usage-section">
            <h2>Installation</h2>
            <p>Resource Fetcher is currently packaged by <a target="_blank" href="https://jsr.io/">JSR.io</a>, it is compatible with NPM managed projects.</p>
            <InstallBlock />
            <h2>Usage</h2>
            <div className="code-tabs">
                <div className="code-tab-bar" role="tablist">
                    {TABS.map(t => (
                        <button
                            key={t.id}
                            role="tab"
                            aria-selected={t.id === active}
                            className={`code-tab-btn${t.id === active ? " code-tab-btn--active" : ""}`}
                            onClick={() => setActive(t.id)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
                <div className="code-tab-panel" role="tabpanel">
                    <SyntaxHighlighter
                        language={tab.language}
                        style={vscDarkPlus}
                        customStyle={{ margin: 0, borderRadius: "0 0 6px 6px", fontSize: "0.8rem" }}
                    >
                        {tab.code}
                    </SyntaxHighlighter>
                </div>
            </div>
        </section>
    )
}
