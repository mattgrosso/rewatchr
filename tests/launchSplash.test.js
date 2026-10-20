import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// The launch splash (2026-10-20): opening the home-screen app used to show a
// plain white page until the app mounted. index.html now paints the app's
// background from the first byte, shows the icon and name inside #app until
// Vue's mount replaces them, and hands iOS a launch image for every current
// iPhone screen (scripts/generate-launch-images.mjs).
const root = resolve(__dirname, '..')
const html = readFileSync(resolve(root, 'index.html'), 'utf8')
const viteConfig = readFileSync(resolve(root, 'vite.config.js'), 'utf8')

// PNG width/height live at fixed offsets in the IHDR chunk.
const pngSize = (file) => {
  const buf = readFileSync(file)
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)]
}

describe('launch splash', () => {
  it('paints the page its dark background before any bundled CSS loads', () => {
    const inlineStyle = html.match(/<style>([\s\S]*?)<\/style>/)[1]
    expect(inlineStyle).toMatch(/html, body \{ background-color: #181210; \}/)
  })

  it('puts the splash inside #app, so mounting the app is what removes it', () => {
    const app = html.match(/<div id="app">([\s\S]*?)<\/div>\s*<script/)[1]
    expect(app).toContain('class="launch-splash"')
    expect(app).toContain('src="/splash-icon.png"')
    expect(app).toContain('Rewatchr')
    expect(existsSync(resolve(root, 'public/splash-icon.png'))).toBe(true)
  })

  it('gives the installed app its own background, not white', () => {
    expect(viteConfig).toMatch(/background_color: '#181210'/)
  })

  it('keeps the launch images out of the service worker precache', () => {
    expect(viteConfig).toMatch(/globIgnores: \[[^\]]*'launch\/\*\*'/)
  })

  it("has a launch image for each listed iPhone screen, at that screen's real pixel size", () => {
    const links = [...html.matchAll(/<link rel="apple-touch-startup-image" href="([^"]+)" media="\(device-width: (\d+)px\) and \(device-height: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d)\)/g)]
    expect(links.length).toBeGreaterThanOrEqual(10)
    for (const [, href, w, h, dpr] of links) {
      const file = resolve(root, 'public' + href)
      expect(existsSync(file), href).toBe(true)
      expect(pngSize(file), href).toEqual([w * dpr, h * dpr])
    }
    expect(links.some(([, , w, h, dpr]) => w === '402' && h === '874' && dpr === '3')).toBe(true)
  })
})
