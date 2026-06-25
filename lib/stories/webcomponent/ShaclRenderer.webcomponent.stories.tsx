import type { StoryContext, StoryObj } from '@storybook/react'
import { useEffect, useRef } from 'react'
import '../../webcomponent'
import { ShaclRendererWebComponent } from '../../webcomponent'

const baseUrl = new URL('/lib/stories/webcomponent/', location.href)
type Story = StoryObj<typeof ShaclRendererWebComponent>

export default {
  title: 'Capabilities/Webcomponent',
  decorators: [
    (_Story: Story, context: StoryContext) => {
      const ref = useRef<HTMLDivElement>(null)

      useEffect(() => {
        ref.current!.innerHTML = `<shacl-renderer ${Object.entries(context.allArgs)
          .map(([name, value]) => `${name}="${value}"`)
          .join(' ')}></shacl-renderer>`
      }, [])

      return <div ref={ref}></div>
    }
  ],
  argTypes: {}
}

export const withShape = {
  args: {
    mode: 'view',
    data: new URL('john.ttl#john', baseUrl).toString(),
    shapes: new URL('contact-closed-view.ttl', baseUrl).toString()
  }
}

export const withoutShape = {
  args: {
    mode: 'view',
    data: new URL('john.ttl#john', baseUrl).toString()
  }
}
