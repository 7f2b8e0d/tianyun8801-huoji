import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages is served under /tianyun8801-huoji/; Cloudflare Pages uses root /
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_ACTIONS === 'true' ? '/tianyun8801-huoji/' : '/',
})