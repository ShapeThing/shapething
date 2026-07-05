import { CSSProperties } from 'react'
import { WidgetProps } from '../../widgets-context'

export default function ColorViewer({ term }: WidgetProps) {
  return (
    <>
      <div className="color-block" style={{ '--color': term.value } as CSSProperties} title={term.value} />
      {term.value}
    </>
  )
}
