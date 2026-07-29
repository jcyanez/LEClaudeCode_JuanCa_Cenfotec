/**
 * Landing-page entry: pulls in the shared Tailwind stylesheet (so the
 * embedded skill-map SVG styles itself with the app's own classes) and swaps
 * the CTA copy for returning practicers.
 */
import './index.css'
import mapMarkup from './landing-map.svg?raw'

// The hero visual: the real skill map (regenerate with
// `npx vite-node scripts/generate-landing-map.tsx`). Inlined so the app's
// own Tailwind classes and pulse/glow animations style it.
const embed = document.getElementById('map-embed')
if (embed) embed.innerHTML = mapMarkup

const returning = Object.keys(localStorage).some((key) =>
  key.startsWith('fretpath'),
)

if (returning) {
  for (const el of document.querySelectorAll('[data-cta-label]')) {
    el.textContent = 'Continue practicing'
  }
}
