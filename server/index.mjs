import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBriefArchive, getBriefArchive, listBriefArchives } from './briefStore.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const port = Number(process.env.PORT ?? 18080)
const distDir = path.resolve(process.env.AGORA_LENS_DIST_DIR ?? path.join(__dirname, '..', 'dist'))
const dataDir = path.resolve(process.env.AGORA_LENS_DATA_DIR ?? path.join(__dirname, '..', 'data'))
const maxBodyBytes = Number(process.env.AGORA_LENS_MAX_BODY_BYTES ?? 256 * 1024)

const server = createServer(async (request, response) => {
  try {
    await routeRequest(request, response)
  } catch (error) {
    const status = error?.statusCode ?? 500
    writeJson(response, status, {
      error: status === 500 ? 'internal server error' : error.message,
    })
    if (status === 500) console.error(error)
  }
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Agora Lens server listening on http://0.0.0.0:${port}`)
  console.log(`Static directory: ${distDir}`)
  console.log(`Data directory: ${dataDir}`)
})

async function routeRequest(request, response) {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)

  if (url.pathname === '/api/health' && request.method === 'GET') {
    writeJson(response, 200, { ok: true, service: 'agora-lens', dataDir })
    return
  }

  if (url.pathname === '/api/briefs' && request.method === 'GET') {
    const parsedLimit = Number(url.searchParams.get('limit') ?? 25)
    const limit = Number.isFinite(parsedLimit) ? parsedLimit : 25
    writeJson(response, 200, { briefs: await listBriefArchives({ dataDir, limit }) })
    return
  }

  if (url.pathname === '/api/briefs' && request.method === 'POST') {
    const body = await readJson(request)
    const record = await createBriefArchive(body, { dataDir })
    writeJson(response, 201, { record })
    return
  }

  const briefMatch = url.pathname.match(/^\/api\/briefs\/([a-zA-Z0-9_-]+)$/)
  if (briefMatch && request.method === 'GET') {
    try {
      writeJson(response, 200, { record: await getBriefArchive(briefMatch[1], { dataDir }) })
    } catch (error) {
      if (error?.code === 'ENOENT') throw httpError(404, 'brief not found')
      throw error
    }
    return
  }

  if (url.pathname.startsWith('/api/')) {
    throw httpError(404, 'api route not found')
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    throw httpError(405, 'method not allowed')
  }

  await serveStatic(url.pathname, response, request.method === 'HEAD')
}

async function readJson(request) {
  const chunks = []
  let size = 0

  for await (const chunk of request) {
    size += chunk.length
    if (size > maxBodyBytes) throw httpError(413, 'request body is too large')
    chunks.push(chunk)
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw httpError(400, 'request body must be valid JSON')
  }
}

async function serveStatic(urlPath, response, isHead) {
  const filePath = safeStaticPath(urlPath)
  const target = await resolveStaticTarget(filePath)
  const contentType = contentTypeFor(target)
  const fileStat = await stat(target)

  response.writeHead(200, {
    'Cache-Control': target.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
    'Content-Length': fileStat.size,
    'Content-Type': contentType,
  })

  if (!isHead) response.end(await readFile(target))
  else response.end()
}

async function resolveStaticTarget(filePath) {
  try {
    const fileStat = await stat(filePath)
    if (fileStat.isFile()) return filePath
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }

  return path.join(distDir, 'index.html')
}

function safeStaticPath(urlPath) {
  const decoded = decodeURIComponent(urlPath)
  const requested = decoded === '/' ? '/index.html' : decoded
  const normalized = path.normalize(requested).replace(/^(\.\.(\/|\\|$))+/, '')
  const filePath = path.resolve(distDir, `.${normalized}`)
  const relativePath = path.relative(distDir, filePath)

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw httpError(403, 'path is not allowed')
  }

  return filePath
}

function writeJson(response, status, payload) {
  const body = `${JSON.stringify(payload)}\n`
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
    'Content-Type': 'application/json; charset=utf-8',
  })
  response.end(body)
}

function httpError(statusCode, message) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

function contentTypeFor(filePath) {
  const extension = path.extname(filePath)
  const mimeTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
  }

  return mimeTypes[extension] ?? 'application/octet-stream'
}
