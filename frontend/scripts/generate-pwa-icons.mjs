#!/usr/bin/env node
/**
 * Генерирует PNG иконки для PWA из public/favicon.svg
 * Требует: npm i -D @resvg/resvg-js
 */
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Resvg } from '@resvg/resvg-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')
const svgPath = join(publicDir, 'favicon.svg')

const sizes = [
  { name: 'apple-touch-icon-180x180.png', size: 180 },
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'pwa-maskable-512x512.png', size: 512, maskable: true },
]

async function main() {
  const svg = await readFile(svgPath)
  for (const { name, size, maskable } of sizes) {
    const renderSize = maskable ? Math.round(size * 0.8) : size
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: renderSize },
      background: '#ffffff',
    })
    const pngData = resvg.render()
    const pngBuffer = pngData.asPng()

    if (maskable) {
      const { Resvg: R2 } = await import('@resvg/resvg-js')
      const offset = Math.round((size - renderSize) / 2)
      const wrapSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
        <rect width="${size}" height="${size}" fill="white"/>
        <image x="${offset}" y="${offset}" width="${renderSize}" height="${renderSize}"
               href="data:image/png;base64,${pngBuffer.toString('base64')}"/>
      </svg>`
      const r2 = new R2(Buffer.from(wrapSvg), { fitTo: { mode: 'width', value: size } })
      await writeFile(join(publicDir, name), r2.render().asPng())
    } else {
      await writeFile(join(publicDir, name), pngBuffer)
    }
    console.log('Written', name)
  }
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
