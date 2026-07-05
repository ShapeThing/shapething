import { createElement, ReactNode } from 'react'

type CommaListProps = {
  items: ReactNode[]
}

export default function CommaList({ items }: CommaListProps) {
  const returnList: ReactNode[] = []

  for (const [index, item] of items.entries()) {
    const mustCreateComma = index + 1 < items.length
    if (item && typeof item === 'object' && 'type' in item) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { children, ...props } = item.props as any
      returnList.push(
        createElement('span', { key: index, ...props }, [
          children,
          mustCreateComma ? (
            <span key="comma">
              ,&nbsp;
              <br />
            </span>
          ) : null
        ])
      )
    } else {
      if (mustCreateComma && item) {
        returnList.push(<span>, </span>)
      }
      returnList.push(item)
    }
  }

  return returnList
}
