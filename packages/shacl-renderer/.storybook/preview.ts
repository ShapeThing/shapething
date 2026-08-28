/// <reference types="vite/client" />
import '@fontsource/roboto/latin.css'
import type { Preview } from '@storybook/react'
import type { ArgTypesEnhancer } from 'storybook/internal/csf'
import '../lib/scss/style.scss'

import whyDidYouRender from '@welldone-software/why-did-you-render'
import React from 'react'

if (import.meta.env.DEV && import.meta.env.VITE_DEBUG === 'true') {
  whyDidYouRender(React, {
    logOnDifferentValues: true,
    trackAllPureComponents: true
  })
}

// Settings fields with a closed set of string values (see lib/core/main-context.ts) render as a
// free-text Controls input by default, since no story declares an argTypes entry for them. Force
// a select dropdown instead so Controls can't be used to type an invalid value.
const ENUM_ARG_OPTIONS: Record<string, readonly string[]> = {
  mode: ['edit', 'facet', 'view'],
  languageMode: ['tabs', 'individual']
}

const selectControlsForEnumArgs: ArgTypesEnhancer = (context) => {
  const enhanced: Record<string, unknown> = {}

  for (const key of Object.keys(context.initialArgs)) {
    const options = ENUM_ARG_OPTIONS[key]
    if (options) {
      enhanced[key] = { control: { type: 'select' }, options }
    }
  }

  return { ...context.argTypes, ...enhanced }
}

const preview: Preview = {
  argTypesEnhancers: [selectControlsForEnumArgs],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    }
  }
}

const registerServiceWorker = async () => {
  if (location && location.port === '63315') return // Skip service worker registration in Storybook vitest integration

  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', {
        scope: '/'
      })
      if (registration.installing) {
        console.log('Service worker installing')
      } else if (registration.waiting) {
        console.log('Service worker installed')
      } else if (registration.active) {
        console.log('Service worker active')
      }
    } catch (error) {
      console.error(`Registration failed with ${error}`)
    }
  }
}

document.fonts.ready.then(() => {
  try {
    registerServiceWorker()
  } catch {}
})

export default preview
