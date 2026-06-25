import { WidgetProps } from '../../widgets-context'
import PropertyGroup from '../PropertyGroup'

export default function HorizontalPropertyGroup(props: WidgetProps) {
  return <PropertyGroup {...props} cssClass="horizontal" />
}
