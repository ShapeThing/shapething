import { useLocalization } from '@fluent/react'
import { Temporal } from '@js-temporal/polyfill'
import factory from '@rdfjs/data-model'
import { ComponentType, useState } from 'react'
import DurationControlModule from 'react-duration-control'
import { DurationControlProps } from 'react-duration-control/dist/DurationControl'
import { stsr, xsd } from '../../../core/namespaces'
import { WidgetProps } from '../../widgets-context'

// There seems to be a problem in this module's export
const DurationControl = (DurationControlModule as unknown as { default: ComponentType<DurationControlProps> }).default

export default function DurationEditor({ term, setTerm, property }: WidgetProps) {
  const pattern = property.out(stsr('durationPattern')).value ?? '{dd}{hh}{mm}{ss}{fff}'
  const { l10n } = useLocalization()

  const labels = {
    dd: l10n.getString('days'),
    hh: l10n.getString('hours'),
    mm: l10n.getString('minutes'),
    ss: l10n.getString('seconds'),
    fff: l10n.getString('milliseconds')
  }

  const parts = pattern.split('}{').map(part => part.replace(/[{}]/g, ''))

  let finalPattern = pattern
  for (const [key, value] of Object.entries(labels)) {
    const index = parts.indexOf(key)
    finalPattern = finalPattern.replace(
      new RegExp(`{${key}}`, 'g'),
      `{${key}} ${value}${index !== parts.length - 1 ? ',' : ''} `
    )
  }

  const [milliseconds, setMilliseconds] = useState(() => {
    try {
      return Temporal.Duration.from(term.value).seconds * 1000
    } catch {
      return 0
    }
  })

  return (
    <DurationControl
      pattern={finalPattern}
      value={milliseconds}
      hideSpinner
      onUnitBlur={() => {
        setTimeout(() => {
          const duration = Temporal.Duration.from({ milliseconds })
          setTerm(factory.literal(duration.toString(), xsd('duration')))
        })
      }}
      onChange={setMilliseconds}
    />
  )
}
