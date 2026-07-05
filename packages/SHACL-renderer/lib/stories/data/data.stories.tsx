import { useEffect, useState } from 'react'
import { ShaclRendererProps } from '../../components/ShaclRenderer'
import { rdfToData } from '../../tools/data/rdfToData'

const baseUrl = new URL('/lib/stories/data/', location.href)

function RenderData(props: ShaclRendererProps) {
  const [json, setJson] = useState<object>()
  useEffect(() => {
    rdfToData(props).then(setJson)
  }, [])

  return json ? (
    <pre>
      <code>{JSON.stringify(json, null, 2)}</code>
    </pre>
  ) : null
}

export default {
  title: 'Capabilities/JavaScript Object',
  component: RenderData,
  argTypes: {}
}

export const withShape = {
  args: {
    data: new URL('john.ttl#john', baseUrl),
    shapes: new URL('contact-closed.ttl', baseUrl),
    context: { '@vocab': 'https://schema.org/' }
  }
}

export const withoutShape = {
  args: {
    data: new URL('john.ttl#john', baseUrl),
    context: { '@vocab': 'https://schema.org/' }
  }
}
