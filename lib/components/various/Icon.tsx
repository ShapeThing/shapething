import { Icon } from '@iconify/react/offline'
import { memo } from 'react'

export const MemoIcon = memo(Icon, (prevProps, nextProps) => {
  return (
    prevProps.icon === nextProps.icon &&
    prevProps.width === nextProps.width &&
    prevProps.height === nextProps.height &&
    prevProps.className === nextProps.className &&
    prevProps.style === nextProps.style
  )
})
