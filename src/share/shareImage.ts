/**
 * P3-2 — the shareable map. Renders the LIVE skill-map SVG (the user's real
 * progress, glow and all) into a branded PNG at 2× resolution, then hands it
 * to the native share sheet where available, or downloads it.
 *
 * Pipeline: clone the SVG → inline the few CSS-dependent styles (the glow
 * drop-shadows live in a stylesheet the serialized SVG can't see) → rasterize
 * via blob-URL Image onto a canvas → paint the brand band → PNG blob.
 * Same-origin blob URLs keep the canvas untainted, so toBlob always works.
 */

export interface ShareStats {
  mastered: number
  total: number
  /** Consecutive practice days; only shown when ≥ 2. */
  streak: number
}

const SCALE = 2
const BAND_H = 96 // brand band height in SVG-space pixels

const INLINE_STYLE = `
  text { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, sans-serif; }
  .glow-amber { filter: drop-shadow(0 0 7px rgba(251, 191, 36, 0.8)); }
  .glow-emerald { filter: drop-shadow(0 0 7px rgba(52, 211, 153, 0.8)); }
`

export async function renderMapImage(
  svgEl: SVGSVGElement,
  stats: ShareStats,
): Promise<Blob> {
  const viewBox = svgEl.viewBox.baseVal
  const width = viewBox.width
  const height = viewBox.height

  const clone = svgEl.cloneNode(true) as SVGSVGElement
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
  style.textContent = INLINE_STYLE
  clone.insertBefore(style, clone.firstChild)

  const svgBlob = new Blob([new XMLSerializer().serializeToString(clone)], {
    type: 'image/svg+xml;charset=utf-8',
  })
  const url = URL.createObjectURL(svgBlob)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('could not rasterize the map'))
      img.src = url
    })

    const canvas = document.createElement('canvas')
    canvas.width = width * SCALE
    canvas.height = (height + BAND_H) * SCALE
    const ctx = canvas.getContext('2d')!
    ctx.scale(SCALE, SCALE)

    ctx.fillStyle = '#09090b'
    ctx.fillRect(0, 0, width, height + BAND_H)
    ctx.drawImage(image, 0, 0, width, height)

    // Brand band
    ctx.fillStyle = '#0c0a09'
    ctx.fillRect(0, height, width, BAND_H)
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, height + 0.5)
    ctx.lineTo(width, height + 0.5)
    ctx.stroke()

    const font = "-apple-system, 'Segoe UI', Roboto, Helvetica, sans-serif"
    ctx.textBaseline = 'middle'
    const midY = height + BAND_H / 2

    ctx.font = `900 30px ${font}`
    ctx.fillStyle = '#ef4444'
    ctx.fillText('FretPath', 36, midY - 12)

    const streakPart = stats.streak >= 2 ? ` · ${stats.streak}-day streak` : ''
    ctx.font = `400 16px ${font}`
    ctx.fillStyle = '#a1a1aa'
    ctx.fillText(
      `The Metal path — ${stats.mastered}/${stats.total} skills mastered${streakPart}`,
      36,
      midY + 18,
    )

    ctx.font = `600 18px ${font}`
    ctx.fillStyle = '#f59e0b'
    ctx.textAlign = 'right'
    ctx.fillText('calandur.com', width - 36, midY)
    ctx.textAlign = 'left'

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('PNG export failed'))),
        'image/png',
      )
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Native share sheet where supported (mobile), download everywhere else. */
export async function shareOrDownload(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'My FretPath map' })
      return
    } catch (err) {
      // User cancelled the sheet → do nothing; real failures fall through.
      if ((err as DOMException).name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
