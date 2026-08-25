import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import shopifyToken from './api/shopify-token.js'
import shopifyProxy from './api/shopify/[...path].js'
import nalpacProxy from './api/nalpac/[...path].js'

// In production these three live in api/ as Vercel serverless functions. The
// dev server has no such thing, so the same handlers are mounted here instead —
// one implementation, both environments.
//
// The two shopify paths don't collide: connect only matches a mount prefix at a
// '/' or '?' boundary, so /api/shopify-token never falls into /api/shopify.
function devApi() {
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use('/api/shopify-token', shopifyToken)
      server.middlewares.use('/api/shopify', shopifyProxy)
      server.middlewares.use('/api/nalpac', nalpacProxy)
    },
  }
}

export default defineConfig({
  plugins: [react(), devApi()],
})
