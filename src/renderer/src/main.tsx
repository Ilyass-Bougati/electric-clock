import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Inter sets the UI. The four monospaced faces below are the selectable
// clock typefaces -- all monospaced so the time never reflows as it ticks
// (`npm run check:fonts` measures that). Browsers only download a face that
// something on screen is actually set in, so the unpicked ones cost nothing.
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import '@fontsource-variable/geist-mono'
import '@fontsource-variable/martian-mono'
import '@fontsource-variable/red-hat-mono'
import './styles.css'
import App from './App'

// The main process resolved the theme before the window was created. Stamping
// it here means the first render already reads the correct tokens, and there
// is no light-to-dark flash to catch.
document.documentElement.dataset.theme = window.api.theme.initial

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
)
