export default {
  type: 'Dataset',
  label: 'My Dataset',
  baseIRI: 'https://example.com/dataset',
  datasetType: 'SparqlEndpoint',
  endpointUrl: 'https://example.com/sparql',
  sparqlQuery: 'SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 100'
}
