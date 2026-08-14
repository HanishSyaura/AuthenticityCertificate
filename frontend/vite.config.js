import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  const entries = fs.readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    const from = path.join(src, entry.name)
    const to = path.join(dest, entry.name)
    if (entry.isDirectory()) copyDir(from, to)
    else if (entry.isFile()) fs.copyFileSync(from, to)
  }
}

function pdfjsAssetsPlugin() {
  let outDir = ''
  let rootDir = ''
  let pdfjsRoot = ''
  return {
    name: 'pdfjs-assets',
    configResolved(config) {
      rootDir = path.resolve(config.root || process.cwd())
      outDir = path.resolve(config.root || process.cwd(), config.build?.outDir || 'dist')
      const pkgJson = require.resolve('pdfjs-dist/package.json')
      pdfjsRoot = path.dirname(pkgJson)
    },
    configureServer(server) {
      const cmapsRoot = path.join(pdfjsRoot, 'cmaps')
      const fontsRoot = path.join(pdfjsRoot, 'standard_fonts')
      server.middlewares.use('/pdfjs/cmaps', (req, res, next) => {
        try {
          const url = String(req.url || '').split('?')[0] || '/'
          const rel = url.replace(/^\/+/, '')
          const fp = path.join(cmapsRoot, rel)
          if (!fp.startsWith(cmapsRoot) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) return next()
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/octet-stream')
          fs.createReadStream(fp).pipe(res)
        } catch {
          next()
        }
      })
      server.middlewares.use('/pdfjs/standard_fonts', (req, res, next) => {
        try {
          const url = String(req.url || '').split('?')[0] || '/'
          const rel = url.replace(/^\/+/, '')
          const fp = path.join(fontsRoot, rel)
          if (!fp.startsWith(fontsRoot) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) return next()
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/octet-stream')
          fs.createReadStream(fp).pipe(res)
        } catch {
          next()
        }
      })
    },
    closeBundle() {
      const cmapsSrc = path.join(pdfjsRoot, 'cmaps')
      const fontsSrc = path.join(pdfjsRoot, 'standard_fonts')
      const cmapsDest = path.join(outDir, 'pdfjs', 'cmaps')
      const fontsDest = path.join(outDir, 'pdfjs', 'standard_fonts')
      if (fs.existsSync(cmapsSrc)) copyDir(cmapsSrc, cmapsDest)
      if (fs.existsSync(fontsSrc)) copyDir(fontsSrc, fontsDest)
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), pdfjsAssetsPlugin()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    cssCodeSplit: true,
    sourcemap: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        manualChunks: {
          pdf: ['pdfjs-dist'],
          quill: ['react-quill', 'quill'],
          katex: ['katex'],
          react: ['react', 'react-dom', 'react-router-dom'],
          framer: ['framer-motion']
        }
      }
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/auth':       { target: 'http://127.0.0.1:5000', changeOrigin: true },
      '/public':     { target: 'http://127.0.0.1:5000', changeOrigin: true },
      '/api':        { target: 'http://127.0.0.1:5000', changeOrigin: true },
      '/products':   { target: 'http://127.0.0.1:5000', changeOrigin: true },
      '/categories': { target: 'http://127.0.0.1:5000', changeOrigin: true },
      '/epc':        { target: 'http://127.0.0.1:5000', changeOrigin: true },
      '/certificates': { target: 'http://127.0.0.1:5000', changeOrigin: true },
      '/cms':        { target: 'http://127.0.0.1:5000', changeOrigin: true },
      '/users':      { target: 'http://127.0.0.1:5000', changeOrigin: true },
      '/templates':  { target: 'http://127.0.0.1:5000', changeOrigin: true },
      '/uploads':    { target: 'http://127.0.0.1:5000', changeOrigin: true },
      '/organizations': { target: 'http://127.0.0.1:5000', changeOrigin: true },
      '/settings':   { target: 'http://127.0.0.1:5000', changeOrigin: true },
      '/access':     { target: 'http://127.0.0.1:5000', changeOrigin: true },
      '/health':     { target: 'http://127.0.0.1:5000', changeOrigin: true }
    }
  }
  ,
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    poolOptions: {
      threads: {
        singleThread: true
      }
    }
  }
})
