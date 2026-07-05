import { Icon } from '@iconify/react'
import { WidgetProps } from '../../widgets-context'

export default function IconifyViewer({ term }: WidgetProps) {
  return <Icon icon={term.value} />
}
