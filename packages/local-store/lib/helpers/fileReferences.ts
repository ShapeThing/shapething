// A file in the folder may refer to another one by its relative path, <other.ttl> or
// <./sub/other.ttl#Thing>, while that file's graph is named without the extension. Absolute IRIs
// are left alone: <https://example.com/vocab.ttl> is a document on the web, not a file here.
export const stripRelativeTtlExtensions = (contents: string): string =>
  contents.replace(/<(?![A-Za-z][A-Za-z0-9+.-]*:)([^<>\s]*)\.ttl([#?][^<>\s]*)?>/g, "<$1$2>");
