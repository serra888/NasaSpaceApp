import { defineConfig } from 'vite'
import tailwind from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
const page=relative=>fileURLToPath(new URL(relative,import.meta.url))
export default defineConfig({
  plugins:[tailwind()],
  esbuild:{jsx:'automatic'},
  build:{rollupOptions:{input:{home:page('./index.html'),garden:page('./mission-garden/index.html'),profile:page('./profile/index.html')}}},
})
