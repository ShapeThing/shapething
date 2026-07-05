import { useCallback, useEffect, useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import FetchDisplay from "./FetchDisplay"
import UsageSection from "./UsageSection"
import { CloseAllContext } from "./CloseAllContext"
import "./App.css"

const queryClient = new QueryClient()
const testNames = Object.keys(import.meta.glob('../public/**/iri.txt')).map(path => path.split('/')[2])

export default function App() {
  const [closeSignal, setCloseSignal] = useState(0)
  const closeAll = useCallback(() => setCloseSignal(n => n + 1), [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('dialog[open]')) closeAll() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [closeAll])

  return (
    <QueryClientProvider client={queryClient}>
      <CloseAllContext.Provider value={closeSignal}>
      <div className="app">
        <header className="app-header">
          <img
            src="logo.svg"
            alt="ShapeThing logo"
            className="logo"
          />
          <h1>Resource Fetcher</h1>
          <a
            href="https://github.com/ShapeThing/resource-fetcher"
            target="_blank"
            rel="noreferrer"
            className="github-link"
            aria-label="View on GitHub"
          >
            <svg height="24" width="24" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
                0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
                -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
                .07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15
                -.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09
                2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82
                2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01
                2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            GitHub
          </a>
        </header>
        <p className="description">
          Fetch everything known about a specific resource from an RDF data source, including
          nested data. Optionally provide a SHACL shape to guide exactly which
          properties and relationships to include.
        </p>
        <UsageSection />
        <section className="test-section">
          <h2>Examples</h2>
          <p>Here are some examples demonstrating how to use the Resource Fetcher. 
            These show the possible inputs and the output. 
            You can also see some of the inner workings of the algorithm.</p>
          <div className="test-list">
            {testNames.map(name => (
              <FetchDisplay key={name} name={name} />
            ))}
          </div>
        </section>
      </div>
      </CloseAllContext.Provider>
    </QueryClientProvider>
  )
}