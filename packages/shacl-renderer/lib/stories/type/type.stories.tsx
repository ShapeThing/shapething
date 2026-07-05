import { useEffect, useState } from 'react'
import { ShaclRendererProps } from '../../components/ShaclRenderer'
import { schema } from '../../core/namespaces'
import { toType } from '../../tools/type/type'

const baseUrl = new URL('/lib/stories/type/', location.href)

function RenderData(props: ShaclRendererProps) {
  const [type, setType] = useState<string>()
  useEffect(() => {
    toType(props).then(convertedType => setType(convertedType?.type))
  }, [])
  return (
    <code>
      <pre>{type}</pre>
    </code>
  )
}

export default {
  title: 'Capabilities/TypeScript Type',
  component: RenderData,
  argTypes: {}
}

export const Type = {
  args: {
    shapes: new URL('contact-closed.ttl', baseUrl),
    targetClass: schema('Person'),
    context: { '@vocab': 'https://schema.org/' }
  }
}
