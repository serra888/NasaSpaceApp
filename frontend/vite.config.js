import {defineConfig,loadEnv} from 'vite'
import tailwind from '@tailwindcss/vite'
export default defineConfig(({mode})=>{const env=loadEnv(mode,process.cwd(),'');return {plugins:[tailwind()],esbuild:{jsx:'automatic'},server:{proxy:{'/api':{target:env.BACKEND_URL||'http://127.0.0.1:8000',changeOrigin:true}}}}})
