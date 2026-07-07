import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const publicDir = path.join(root, 'public')
const iconsDir = path.join(publicDir, 'icons')
const storeDir = path.join(publicDir, 'store')

const palette = {
  ink: '#1f120f',
  cream: '#f4ecdf',
  forest: '#123c3a',
  gold: '#c9792c',
  mist: '#f7f1e7',
}

function renderPng(svg, width) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
  })
  return resvg.render().asPng()
}

function brandMarkSvg(size) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${palette.mist}" />
          <stop offset="100%" stop-color="${palette.cream}" />
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="25%" r="70%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.85"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="512" height="512" rx="132" fill="url(#bg)"/>
      <circle cx="256" cy="90" r="180" fill="url(#glow)"/>
      <circle cx="256" cy="256" r="196" fill="${palette.forest}"/>
      <circle cx="256" cy="256" r="162" fill="#ffffff"/>
      <path d="M156 146 L282 146 L352 216" stroke="${palette.ink}" stroke-width="20" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M354 366 L228 366 L160 296" stroke="${palette.ink}" stroke-width="20" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="172" y="241" width="168" height="30" rx="6" fill="${palette.ink}"/>
      <rect x="184" y="246" width="144" height="20" rx="4" fill="${palette.gold}"/>
      <text x="256" y="262" text-anchor="middle" font-family="Arial" font-size="19" font-weight="700" letter-spacing="3" fill="#ffffff">PEDALS POWER</text>
    </svg>
  `
}

function maskableIconSvg(size) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
      <rect width="512" height="512" fill="${palette.forest}"/>
      <circle cx="256" cy="256" r="214" fill="${palette.cream}"/>
      <circle cx="256" cy="256" r="184" fill="#ffffff"/>
      <path d="M156 146 L282 146 L352 216" stroke="${palette.ink}" stroke-width="20" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M354 366 L228 366 L160 296" stroke="${palette.ink}" stroke-width="20" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="172" y="241" width="168" height="30" rx="6" fill="${palette.ink}"/>
      <rect x="184" y="246" width="144" height="20" rx="4" fill="${palette.gold}"/>
      <text x="256" y="262" text-anchor="middle" font-family="Arial" font-size="19" font-weight="700" letter-spacing="3" fill="#ffffff">PEDALS POWER</text>
    </svg>
  `
}

function featureGraphicSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${palette.forest}" />
          <stop offset="50%" stop-color="#0c2632" />
          <stop offset="100%" stop-color="#29160f" />
        </linearGradient>
        <radialGradient id="sun" cx="80%" cy="24%" r="28%">
          <stop offset="0%" stop-color="#ffd18a" stop-opacity="1"/>
          <stop offset="100%" stop-color="#ffd18a" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f4bf77"/>
          <stop offset="100%" stop-color="${palette.gold}"/>
        </linearGradient>
      </defs>
      <rect width="1024" height="500" rx="48" fill="url(#bg)"/>
      <rect x="16" y="16" width="992" height="468" rx="36" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="2"/>
      <circle cx="828" cy="128" r="132" fill="url(#sun)"/>
      <path d="M530 500 C640 340 736 252 1024 128 L1024 500 Z" fill="rgba(246,164,76,0.18)"/>
      <text x="72" y="86" font-family="Arial" font-size="24" letter-spacing="8" fill="rgba(255,255,255,0.72)">PEDALS POWER</text>
      <text x="72" y="188" font-family="Georgia" font-size="84" font-weight="700" fill="#ffffff">Register.</text>
      <text x="72" y="270" font-family="Georgia" font-size="84" font-weight="700" fill="#ffffff">Ride.</text>
      <text x="72" y="352" font-family="Georgia" font-size="84" font-weight="700" fill="#ffffff">Share.</text>
      <text x="72" y="406" font-family="Arial" font-size="28" fill="rgba(255,255,255,0.8)">Mobile-first challenge journeys with poster and certificate generation.</text>
      <g transform="translate(736 78)">
        <circle cx="120" cy="120" r="112" fill="#ffffff"/>
        <path d="M58 54 L130 54 L184 108 M182 188 L112 188 L58 132" stroke="${palette.ink}" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="74" y="108" width="104" height="18" rx="4" fill="${palette.ink}"/>
        <rect x="82" y="111" width="88" height="12" rx="3" fill="${palette.gold}"/>
        <text x="126" y="121" text-anchor="middle" font-family="Arial" font-size="10" font-weight="700" letter-spacing="2" fill="#ffffff">PEDALS POWER</text>
      </g>
      <rect x="72" y="430" width="198" height="18" rx="9" fill="url(#gold)"/>
    </svg>
  `
}

async function main() {
  await mkdir(iconsDir, { recursive: true })
  await mkdir(storeDir, { recursive: true })

  const files = [
    [path.join(iconsDir, 'icon-192.png'), renderPng(brandMarkSvg(512), 192)],
    [path.join(iconsDir, 'icon-512.png'), renderPng(brandMarkSvg(512), 512)],
    [path.join(iconsDir, 'maskable-512.png'), renderPng(maskableIconSvg(512), 512)],
    [path.join(storeDir, 'play-store-icon-512.png'), renderPng(brandMarkSvg(512), 512)],
    [path.join(storeDir, 'play-store-feature-graphic-1024x500.png'), renderPng(featureGraphicSvg(), 1024)],
  ]

  await Promise.all(files.map(([filePath, buffer]) => writeFile(filePath, buffer)))
  console.log('Generated release assets in public/icons and public/store')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
