export default [
  {
    'rdf:type': ['https://schema.org/Person'],
    givenName: ['Hendrik', 'Jan'],
    familyName: ['Doe'],
    name: ['Hendrik Jan Doe'],
    child: ['Anna', 'Lisa', 'John jr'],
    birthDate: [new Date('1947-01-14T00:00:00.000Z')],
    householdMembers: [6],
    icon: ['line-md:buy-me-a-coffee-twotone'],
    image: ['/woman.jpg'],
    iri: '#john',
    selfReference: ['#john'],
    favoriteColor: ['#ff33ff'],
    isHuman: [true],
    knows: ['http://dbpedia.org/resource/Søren_Kierkegaard'],
    address: [
      {
        'rdf:type': ['https://schema.org/PostalAddress'],
        streetAddress: ['Wagramer Strasse 5'],
        postalCode: ['1220'],
        addressRegion: ['Wien'],
        addressLocality: ['Wien'],
        addressCountry: ['Austria']
      }
    ]
  }
]
