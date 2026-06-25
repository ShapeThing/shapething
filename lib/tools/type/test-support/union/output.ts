export type Person = {
  iri: string
  givenName: Array<string>
  familyName: string
  gender?: 'Male' | 'Female'
  address?:
    | {
        streetAddress: string
        postalCode: string
        addressLocality: string
        addressRegion: string
        addressCountry: string
      }
    | {
        streetAddress: string
        postalCode: string
        addressLocality: string
      }
    | string
}
