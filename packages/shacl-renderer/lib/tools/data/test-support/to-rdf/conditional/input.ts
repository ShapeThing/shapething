export default {
  type: 'Dataset',
  label: 'My Dataset',
  baseIRI: 'https://example.org/dataset',
  datasetType: 'SparqlEndpoint',
  endpointUrl: 'https://example.org/sparql',
  sparqlQuery: 'SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 100'
}
