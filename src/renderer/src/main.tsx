import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// The four selectable display faces. Browsers only download a face that
// something on screen is actually set in, so three of these cost nothing
// until the user picks them. Fraunces uses its full build for the optical
// size, SOFT and WONK axes the clock leans on.
import '@fontsource-variable/inter'
import '@fontsource-variable/space-grotesk'
import '@fontsource-variable/fraunces/full.css'
import '@fontsource-variable/jetbrains-mono'
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
