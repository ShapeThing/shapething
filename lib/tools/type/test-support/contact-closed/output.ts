export type Person = {
  iri: string
  givenName: Array<string>
  gender?: 'Male' | 'Female'
  familyName: string
  favoriteColor?: string
  isHuman?: boolean
  icon?: Array<string>
  knows?: Array<string>
  birthDate: Date
  child?: Array<string>
  address?: {
    streetAddress: string
    postalCode: string
    addressLocality: string
    addressRegion: string
    addressCountry: string
  }
}
