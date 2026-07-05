export default [
  {
    baseIRI: 'https://example.com/dataset',
    datasetType: 'SparqlEndpoint',
    endpointUrl: 'https://example.com/sparql',
    iri: 'test',
    sparqlQuery: 'SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 100',
    type: 'Dataset'
  }
]
