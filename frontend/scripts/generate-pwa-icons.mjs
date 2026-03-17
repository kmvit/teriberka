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
  { name: 'pwa-maskable-512x512.png', size: 512 },
]

async function main() {
  const svg = await readFile(svgPath)
  for (const { name, size } of sizes) {
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: size },
      background: 'rgba(255, 255, 255, 0)',
    })
    const pngData = resvg.render()
    const pngBuffer = pngData.asPng()
    await writeFile(join(publicDir, name), pngBuffer)
    console.log('Written', name)
  }
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
