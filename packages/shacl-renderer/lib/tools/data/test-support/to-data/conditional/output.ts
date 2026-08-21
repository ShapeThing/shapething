export default [
  {
    baseIRI: 'https://example.org/dataset',
    datasetType: 'SparqlEndpoint',
    endpointUrl: 'https://example.org/sparql',
    iri: 'test',
    sparqlQuery: 'SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 100',
    type: 'Dataset'
  }
]
