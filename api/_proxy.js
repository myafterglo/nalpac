// Shared plumbing for the three relay endpoints. These handlers run in two
// places — as Vercel serverless functions in production, and mounted onto the
// Vite dev server in vite.config.js — so they stick to plain Node req/res and
// avoid anything specific to either host.

export const API_VERSION = '2025-01'

export function json(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

// Everything after the mount prefix is the upstream path, e.g. /products.json
// or /product?keyword=… . Vite's connect strips the prefix from req.url before
// the handler sees it but keeps the whole thing on originalUrl; Vercel passes
// the full path through on req.url. Reading originalUrl first covers both.
export function upstreamPath(req, prefix) {
  const url = req.originalUrl || req.url || ''
  return url.startsWith(prefix) ? url.slice(prefix.length) || '/' : url
}

export async function readBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined
  // Vercel parses a JSON body before the handler runs, which leaves the stream
  // empty; the dev server doesn't parse it at all.
  if (req.body !== undefined && req.body !== null && req.body !== '') {
    return typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
  }
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return chunks.length ? Buffer.concat(chunks) : undefined
}

// Shopify and Nalpac both answer auth failures with an HTML page rather than
// JSON, so anything that isn't JSON is replaced with an error the client can read.
export function endAsJson(res, status, text, fallback) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  const trimmed = (text || '').trimStart()
  res.end(trimmed.startsWith('{') || trimmed.startsWith('[') ? text : JSON.stringify(fallback))
}
