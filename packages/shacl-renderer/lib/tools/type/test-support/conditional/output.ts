export type Dataset = {
  type: 'Dataset'
  label: string
  baseIRI: string
  datasetType: 'SparqlEndpoint' | 'LocalFolder'
} & (
  | {
      datasetType: 'LocalFolder'
      folderPath: string
    }
  | {
      datasetType: 'SparqlEndpoint'
      endpointUrl: string
      sparqlQuery?: Array<string>
    }
)
