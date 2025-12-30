import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@mantine/dates/styles.css'
import './styles/global.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider defaultColorScheme="dark" withGlobalStyles withNormalizeCSS>
      <Notifications position="top-right" />
      <App />
    </MantineProvider>
  </StrictMode>,
)
