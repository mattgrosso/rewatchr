// Generates the PWA icons: a little retro TV, screen glowing amber, rabbit
// ears up — the app in one glance. Raw PNG encoding via zlib so there's no
// image dependency; run `yarn make-icons` after changing anything here.

import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

const crc32 = (buf) => {
  let c = 0xffffffff
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

const encodePng = (pixels, size) => {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filter: none
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

const BG = hex('#181210')
const BODY = hex('#57432f')
const BODY_EDGE = hex('#3a2c1e')
const SCREEN = hex('#f59e0b')
const SCREEN_HI = hex('#fbbf24')
const DARK = hex('#2a1a02')

const drawIcon = (size, { rounded = true } = {}) => {
  const px = Buffer.alloc(size * size * 4)
  const cornerR = rounded ? size * 0.19 : 0
  const put = (x, y, [r, g, b]) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const i = (y * size + x) * 4
    px[i] = r
    px[i + 1] = g
    px[i + 2] = b
    px[i + 3] = 255
  }
  const insideRounded = (x, y) => {
    if (!cornerR) return true
    const rx = Math.min(x, size - 1 - x)
    const ry = Math.min(y, size - 1 - y)
    if (rx >= cornerR || ry >= cornerR) return true
    const dx = cornerR - rx
    const dy = cornerR - ry
    return dx * dx + dy * dy <= cornerR * cornerR
  }
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) if (insideRounded(x, y)) put(x, y, BG)

  const rect = (x0, y0, x1, y1, color) => {
    for (let y = Math.round(size * y0); y <= Math.round(size * y1); y++)
      for (let x = Math.round(size * x0); x <= Math.round(size * x1); x++)
        if (insideRounded(x, y)) put(x, y, color)
  }

  // Thick line segment (for the rabbit ears), fractions in, pixels out.
  const line = (ax, ay, bx, by, color, widthFrac) => {
    const w = Math.max(1.2, size * widthFrac)
    const x0 = ax * size
    const y0 = ay * size
    const x1 = bx * size
    const y1 = by * size
    const minX = Math.floor(Math.min(x0, x1) - w)
    const maxX = Math.ceil(Math.max(x0, x1) + w)
    const minY = Math.floor(Math.min(y0, y1) - w)
    const maxY = Math.ceil(Math.max(y0, y1) + w)
    const lenSq = (x1 - x0) ** 2 + (y1 - y0) ** 2
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const t = lenSq ? Math.max(0, Math.min(1, ((x - x0) * (x1 - x0) + (y - y0) * (y1 - y0)) / lenSq)) : 0
        const dx = x - (x0 + t * (x1 - x0))
        const dy = y - (y0 + t * (y1 - y0))
        if (dx * dx + dy * dy <= w * w && insideRounded(x, y)) put(x, y, color)
      }
    }
  }

  // Rabbit ears meeting at the set's top center.
  line(0.5, 0.34, 0.32, 0.12, BODY, 0.018)
  line(0.5, 0.34, 0.68, 0.12, BODY, 0.018)

  // The set: body, then the screen inset with a lighter top-left "glow".
  rect(0.16, 0.32, 0.84, 0.84, BODY_EDGE)
  rect(0.18, 0.34, 0.82, 0.82, BODY)
  rect(0.23, 0.4, 0.71, 0.76, SCREEN)
  rect(0.23, 0.4, 0.47, 0.58, SCREEN_HI)

  // Play wedge on the screen: today's episode, ready to go.
  const px0 = 0.4
  const px1 = 0.56
  const cy = 0.58
  const half = 0.09
  for (let x = Math.round(size * px0); x <= Math.round(size * px1); x++) {
    const t = (x / size - px0) / (px1 - px0)
    const h = half * (1 - t) * size
    for (let y = Math.round(size * cy - h); y <= Math.round(size * cy + h); y++) put(x, y, DARK)
  }

  // Control column: two knobs to the right of the screen.
  const knob = (cxF, cyF, rF) => {
    const r = size * rF
    const cx = size * cxF
    const cyy = size * cyF
    for (let y = Math.round(cyy - r); y <= Math.round(cyy + r); y++)
      for (let x = Math.round(cx - r); x <= Math.round(cx + r); x++)
        if ((x - cx) ** 2 + (y - cyy) ** 2 <= r * r) put(x, y, DARK)
  }
  knob(0.765, 0.47, 0.035)
  knob(0.765, 0.585, 0.035)

  return encodePng(px, size)
}

writeFileSync(join(OUT, 'icon-512.png'), drawIcon(512))
writeFileSync(join(OUT, 'icon-192.png'), drawIcon(192))
writeFileSync(join(OUT, 'apple-touch-icon.png'), drawIcon(180, { rounded: false }))
writeFileSync(join(OUT, 'favicon-32.png'), drawIcon(32))
console.log('icons written to public/')
