import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// SINGLE=1：1 ファイルの HTML にまとめる（claude.ai の共有ページ用）
// PWA=1：ホーム画面に追加できるアプリとして書き出す（dist-pwa、manifest・service worker つき）
const PWA = !!process.env.PWA

const pwaHead = (): Plugin => ({
  name: 'mylife-pwa-head',
  transformIndexHtml: (html) => html.replace('</head>', `    <link rel="manifest" href="./manifest.webmanifest" />
    <link rel="apple-touch-icon" href="./apple-touch-icon.png" />
    <link rel="icon" type="image/png" href="./icon-192.png" />
  </head>`),
})

export default defineConfig({
  plugins: [react(), ...(process.env.SINGLE || PWA ? [viteSingleFile()] : []), ...(PWA ? [pwaHead()] : [])],
  base: './',
  define: { __PWA__: JSON.stringify(PWA) },
  publicDir: PWA ? 'public' : false,
  build: { outDir: PWA ? 'dist-pwa' : 'dist' },
})
