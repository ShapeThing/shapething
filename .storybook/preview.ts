/// <reference types="vite/client" />
import '@fontsource/roboto/latin.css'
import type { Preview } from '@storybook/react'
import '../lib/scss/style.scss'

import whyDidYouRender from '@welldone-software/why-did-you-render'
import React from 'react'

if (import.meta.env.DEV && import.meta.env.VITE_DEBUG === 'true') {
  whyDidYouRender(React, {
    logOnDifferentValues: true,
    trackAllPureComponents: true
  })
}

const preview: Preview = {
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
