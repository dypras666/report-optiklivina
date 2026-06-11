import express from 'express'
import cors from 'cors'
import compression from 'compression'
import { pool } from './db.js'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import reportsRouter from './routes/reports.js'
import customersRouter from './routes/customers.js'
import marketingRouter from './routes/marketing.js'
import tokoRouter from './routes/toko.js'
import asetRouter from './routes/aset.js'
import omsetRouter from './routes/omset.js'
import pembukuanRouter from './routes/pembukuan.js'
import optionsRouter from './routes/options.js'
import analyticsRouter from './routes/analytics.js'
import ktpRouter from './routes/ktp.js'
import collectorsRouter from './routes/collectors.js'
import sponsorsRouter from './routes/sponsors.js'

import { fetchMarketingOverdue, fetchMarketingOverdueTransactions, fetchMarketingProductDistribution, fetchMarketingCustomerCompleteness } from './services/reportsService.js'
import { fetchMarketingProductItems, fetchMarketingMonthlyTransactions, fetchMarketingTransactionsBasic, fetchMarketingProductItemsBatch, fetchMarketingProductItemsPage, fetchMarketingProductItemsCorePage, enrichProductRows } from './services/reportsService.js'
import { Queue, Worker } from 'bullmq'
import Redis from 'ioredis'
import { getActivePembukuan } from './services/pembukuanService.js'

const app = express()
app.use(compression({ level: 6 })) // Enable gzip compression
app.use(express.json())
app.use(cors({ origin: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }))
app.options('*', cors())

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

app.use((req, res, next) => {
  const start = process.hrtime.bigint()
  const url = req.originalUrl
  const method = req.method
  res.on('finish', () => {
    const end = process.hrtime.bigint()
    const ms = Number((end - start) / BigInt(1_000_000))
    const status = res.statusCode
    const size = Number(res.getHeader('Content-Length') || 0)
    const qsize = Buffer.byteLength(JSON.stringify(req.query || {}))
    const warn = ms > 5000 || size > 5_000_000
    const msg = `[API] ${method} ${url} status=${status} ms=${ms} size=${size} qsize=${qsize}`
    if (warn) console.warn(msg)
    else console.log(msg)
  })
  next()
})

app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok')
    res.json({ ok: rows[0].ok === 1 })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

function b64url(s) { return Buffer.from(s).toString('base64url') }
function signToken(payload, secret) {
  const data = b64url(JSON.stringify(payload))
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url')
  return `${data}.${sig}`
}
function verifyToken(token, secret) {
  if (!token || !secret) return null
  const parts = String(token).split('.')
  if (parts.length !== 2) return null
  const [data, sig] = parts
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url')
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'))
    if (payload.exp && Date.now() > payload.exp) return null
    return payload
  } catch { return null }
}

app.post('/api/auth/login', async (req, res) => {
  try {
    const u = String(req.body?.username || '')
    const p = String(req.body?.password || '')
    const adminU = process.env.ADMIN_USER || ''
    const adminP = process.env.ADMIN_PASS || ''
    const secret = process.env.AUTH_SECRET || ''
    if (!adminU || !adminP || !secret) return res.status(500).json({ error: 'auth not configured' })
    if (u !== adminU || p !== adminP) return res.status(401).json({ error: 'invalid credentials' })
    const iat = Date.now()
    const exp = iat + (12 * 60 * 60 * 1000)
    const token = signToken({ sub: u, iat, exp }, secret)
    res.json({ token })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

function requireAuth(req, res, next) {
  try {
    const url = req.originalUrl || ''
    const method = req.method

    // Explicitly public routes (whitelist)
    const publicPaths = [
      '/api/health',
      '/api/auth/login',
      '/api/options',
      '/api/pembukuan/active',
      '/api/aset',
      '/api/reports/aset',
      '/api/reports/generated'
    ]
    if (publicPaths.some(p => url.startsWith(p))) return next()

    // Otherwise, check for token
    const auth = req.headers['authorization'] || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : (req.query?.token || '')
    const secret = process.env.AUTH_SECRET || ''
    const payload = verifyToken(token, secret)
    if (!payload) return res.status(401).json({ error: 'unauthorized' })
    next()
  } catch { return res.status(401).json({ error: 'unauthorized' }) }
}

app.use('/api/reports', requireAuth, reportsRouter)
app.use('/api/customers', requireAuth, customersRouter)
app.use('/api/marketing', requireAuth, marketingRouter)
app.use('/api/toko', requireAuth, tokoRouter)
app.use('/api/aset', requireAuth, asetRouter)
app.use('/api/omset', requireAuth, omsetRouter)
app.use('/api/pembukuan', requireAuth, pembukuanRouter)
app.use('/api/options', optionsRouter)
app.use('/api/analytics', requireAuth, analyticsRouter)
app.use('/api/collectors', requireAuth, collectorsRouter)
app.use('/api/sponsors', requireAuth, sponsorsRouter)
app.use('/api', requireAuth, ktpRouter)


// Simple in-memory job queue for report generation
const JOBS = new Map()
const QUEUE = []
let WORKING = false
const EVENT_CLIENTS = new Set()
let HEARTBEAT = null

const REDIS_URL = process.env.REDIS_URL || process.env.BULLMQ_REDIS_URL || ''
let BULL_ENABLED = false
let bullQueue = null
let bullWorker = null
try {
  if (REDIS_URL) {
    const redis = new Redis(REDIS_URL)
    bullQueue = new Queue('reportQueue', { connection: redis })
    bullWorker = new Worker('reportQueue', async (job) => {
      const marketingId = job.data?.marketingId
      const pembukuanId = job.data?.pembukuanId
      const mkName = await getMarketingName(marketingId)
      const active = await getActivePembukuan(pembukuanId)
      const period = active ? `${active.tanggal_buka_buku} — ${active.tanggal_tutup_buku}` : ''
      const next = { id: job.id, type: job.name, payload: job.data, status: 'in_progress', created_at: Date.now(), started_at: Date.now(), finished_at: null, progress: 0, result: null, error: null, marketing_name: mkName, period_text: period }
      await dbUpdateJobStarted(next.id, next.started_at)
      HEARTBEAT && clearInterval(HEARTBEAT)
      HEARTBEAT = setInterval(() => {
        try { broadcastEvent({ type: 'job_progress', id: next.id, job_type: next.type, progress: next.progress, label: next.marketing_name ? `${next.marketing_name} • ${next.period_text || ''}` : next.period_text || '' }) } catch { }
      }, 1000)
      try {
        if (next.type === 'analysisMarketing') {
          const marketingId = next.payload?.marketingId
          const result = {}
          const stepsEarly = [
            async () => ({ key: 'summary', value: await fetchMarketingOverdue({ marketingId, pembukuanId: next.payload?.pembukuanId }) }),
            async () => ({ key: 'transactions', value: await fetchMarketingOverdueTransactions({ marketingId, pembukuanId: next.payload?.pembukuanId }) }),
            async () => ({ key: 'distribution', value: await fetchMarketingProductDistribution({ marketingId, pembukuanId: next.payload?.pembukuanId }) }),
            async () => ({ key: 'completeness', value: await fetchMarketingCustomerCompleteness({ marketingId, pembukuanId: next.payload?.pembukuanId }) }),
          ]
          for (let i = 0; i < stepsEarly.length; i++) {
            const r = await stepsEarly[i]()
            result[r.key] = r.value
            next.progress = Math.round(((i + 1) / 7) * 90)
            job.updateProgress(next.progress)
            await dbUpdateJobProgress(next.id, next.progress, 'in_progress')
            broadcastEvent({ type: 'job_progress', id: next.id, job_type: next.type, progress: next.progress, step: r.key, label: next.marketing_name ? `${next.marketing_name} • ${next.period_text || ''}` : next.period_text || '' })
          }
          const itemsRaw = await fetchMarketingProductItemsBatch({ marketingId, pembukuanId: next.payload?.pembukuanId })
          result['items'] = itemsRaw
          next.progress = Math.round((5 / 7) * 90)
          job.updateProgress(next.progress)
          await dbUpdateJobProgress(next.id, next.progress, 'in_progress')
          broadcastEvent({ type: 'job_progress', id: next.id, job_type: next.type, progress: next.progress, step: 'items', label: next.marketing_name ? `${next.marketing_name} • ${next.period_text || ''}` : next.period_text || '' })
          const monthly = await fetchMarketingMonthlyTransactions({ marketingId, pembukuanId: next.payload?.pembukuanId })
          result['monthly'] = monthly
          next.progress = Math.round((6 / 7) * 90)
          job.updateProgress(next.progress)
          await dbUpdateJobProgress(next.id, next.progress, 'in_progress')
          broadcastEvent({ type: 'job_progress', id: next.id, job_type: next.type, progress: next.progress, step: 'monthly', label: next.marketing_name ? `${next.marketing_name} • ${next.period_text || ''}` : next.period_text || '' })
          const allTransactions = await fetchMarketingTransactionsBasic({ marketingId, pembukuanId: next.payload?.pembukuanId })
          result['allTransactions'] = allTransactions
          next.progress = Math.round((7 / 7) * 90)
          job.updateProgress(next.progress)
          await dbUpdateJobProgress(next.id, next.progress, 'in_progress')
          broadcastEvent({ type: 'job_progress', id: next.id, job_type: next.type, progress: next.progress, step: 'allTransactions', label: next.marketing_name ? `${next.marketing_name} • ${next.period_text || ''}` : next.period_text || '' })
          next.result = result
          const filePath = path.join(GENERATED_DIR, `${next.id}.json`)
          const payloadToSave = { id: next.id, type: next.type, payload: next.payload, created_at: next.created_at, finished_at: Date.now(), result: next.result }
          await fs.promises.writeFile(filePath, JSON.stringify(payloadToSave))
        } else {
          throw new Error('Unknown job type')
        }
        next.progress = 100
        next.status = 'completed'
        job.updateProgress(100)
        await dbUpdateJobCompleted(next.id, next.result)
      } catch (e) {
        next.error = e.message
        next.status = 'failed'
        await dbUpdateJobFailed(next.id, next.error)
      } finally {
        next.finished_at = Date.now()
        HEARTBEAT && clearInterval(HEARTBEAT); HEARTBEAT = null
        broadcastEvent({ type: 'job_progress', id: next.id, job_type: next.type, progress: next.progress, label: next.marketing_name ? `${next.marketing_name} • ${next.period_text || ''}` : next.period_text || '' })
        broadcastEvent({ type: 'job_completed', id: next.id, status: next.status, error: next.error || null, job_type: next.type, label: next.marketing_name ? `${next.marketing_name} • ${next.period_text || ''}` : next.period_text || '' })
      }
    })
    BULL_ENABLED = true
    console.log('[BullMQ] enabled')
  }
} catch (e) { console.warn('[BullMQ] disabled:', e.message) }

const GENERATED_DIR = path.join(process.cwd(), 'generated-reports')
try { fs.mkdirSync(GENERATED_DIR, { recursive: true }) } catch { }

async function ensureJobsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS report_jobs (
        id VARCHAR(64) PRIMARY KEY,
        type VARCHAR(64),
        status VARCHAR(32),
        progress INT,
        payload_json TEXT,
        result_json LONGTEXT,
        error TEXT,
        created_at BIGINT,
        started_at BIGINT,
        finished_at BIGINT,
        marketing_name VARCHAR(255),
        period_text VARCHAR(255)
      )
    `)
  } catch { }
}

async function ensureAssetStatusTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS asset_status (
        jenis VARCHAR(16) NOT NULL,
        product_id INT NOT NULL,
        status TINYINT(1) NOT NULL DEFAULT 1,
        updated_at BIGINT NOT NULL,
        PRIMARY KEY (jenis, product_id)
      )
    `)
  } catch { }
}

async function dbInsertJob(job) {
  const payload = JSON.stringify(job.payload || {})
  const values = [job.id, job.type, job.status, job.progress || 0, payload, null, job.error || null, job.created_at, job.started_at, job.finished_at, job.marketing_name || null, job.period_text || null]
  await pool.query('REPLACE INTO report_jobs (id,type,status,progress,payload_json,result_json,error,created_at,started_at,finished_at,marketing_name,period_text) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', values)
}
async function dbUpdateJobProgress(id, progress, status) {
  await pool.query('UPDATE report_jobs SET progress=?, status=? WHERE id=?', [progress, status, id])
}
async function dbUpdateJobStarted(id, ts) {
  await pool.query('UPDATE report_jobs SET status=?, started_at=? WHERE id=?', ['in_progress', ts, id])
}
async function dbUpdateJobCompleted(id, result) {
  await pool.query('UPDATE report_jobs SET status=?, progress=?, finished_at=?, result_json=? WHERE id=?', ['completed', 100, Date.now(), JSON.stringify(result || {}), id])
}
async function dbUpdateJobFailed(id, error) {
  await pool.query('UPDATE report_jobs SET status=?, finished_at=?, error=? WHERE id=?', ['failed', Date.now(), String(error || ''), id])
}
async function dbGetNextPending() {
  const [rows] = await pool.query('SELECT * FROM report_jobs WHERE status = ? ORDER BY created_at ASC LIMIT 1', ['pending'])
  return rows[0] || null
}
async function dbRequeueStuckInProgress(thresholdMs = 120000) {
  try {
    const cutoff = Date.now() - thresholdMs
    const [rows] = await pool.query('SELECT id FROM report_jobs WHERE status = ? AND (finished_at IS NULL OR finished_at = 0) AND started_at IS NOT NULL AND started_at < ? LIMIT 10', ['in_progress', cutoff])
    for (const r of rows) {
      await pool.query('UPDATE report_jobs SET status = ?, started_at = NULL WHERE id = ?', ['pending', r.id])
    }
    return rows.map(r => r.id)
  } catch { return [] }
}
async function dbListJobs() {
  const [rows] = await pool.query('SELECT id,type,status,progress,created_at,started_at,finished_at,marketing_name,period_text FROM report_jobs ORDER BY created_at DESC LIMIT 50')
  return rows
}
async function dbGetJob(id) {
  const [rows] = await pool.query('SELECT * FROM report_jobs WHERE id = ? LIMIT 1', [id])
  return rows[0] || null
}
async function dbDeleteJob(id) {
  try {
    await pool.query('DELETE FROM report_jobs WHERE id = ?', [id])
  } catch { }
}
async function getMarketingName(marketingId) {
  if (!marketingId) return ''
  const [rows] = await pool.query('SELECT nama_lengkap FROM admin WHERE id = ? LIMIT 1', [marketingId])
  return rows?.[0]?.nama_lengkap || ''
}
ensureJobsTable()
ensureAssetStatusTable()

setImmediate(runNext)
setInterval(runNext, 15000)

function enqueueJob({ type, payload }) {
  const id = String(Date.now()) + '-' + String(JOBS.size + 1)
  const job = { id, type, payload, status: 'pending', created_at: Date.now(), started_at: null, finished_at: null, progress: 0, result: null, error: null }
  JOBS.set(id, job)
  setImmediate(async () => {
    try {
      const marketingId = job.payload?.marketingId
      const pembukuanId = job.payload?.pembukuanId
      const mkName = await getMarketingName(marketingId)
      const active = Number.isInteger(pembukuanId) ? await getActivePembukuan(pembukuanId) : null
      const period = active ? `${active.tanggal_buka_buku} — ${active.tanggal_tutup_buku}` : ''
      job.marketing_name = mkName
      job.period_text = period
      await dbInsertJob(job)
      broadcastEvent({ type: 'job_enqueued', id, job_type: type, status: 'pending', progress: 0, label: mkName ? `${mkName} • ${period}` : period })
      if (BULL_ENABLED && bullQueue) { await bullQueue.add(type, payload, { jobId: id, removeOnComplete: true, attempts: 1 }) }
    } catch { }
  })
  if (!BULL_ENABLED) { QUEUE.push(job); setImmediate(runNext) }
  return id
}

async function runNext() {
  if (WORKING) return
  let next = QUEUE.shift()
  if (!next) {
    try {
      await dbRequeueStuckInProgress(120000)
      const p = await dbGetNextPending()
      if (!p) return
      next = { id: p.id, type: p.type, payload: JSON.parse(p.payload_json || '{}'), status: p.status, created_at: p.created_at, started_at: p.started_at, finished_at: p.finished_at, progress: p.progress, result: null, error: null, marketing_name: p.marketing_name, period_text: p.period_text }
      JOBS.set(next.id, next)
    } catch (err) {
      console.error("[Job Queue] DB error while polling:", err.message)
      return
    }
  }
  WORKING = true
  next.status = 'in_progress'
  next.started_at = Date.now()
  await dbUpdateJobStarted(next.id, next.started_at)
  try { HEARTBEAT && clearInterval(HEARTBEAT) } catch { }
  HEARTBEAT = setInterval(() => {
    try { broadcastEvent({ type: 'job_progress', id: next.id, job_type: next.type, progress: next.progress, label: next.marketing_name ? `${next.marketing_name} • ${next.period_text || ''}` : next.period_text || '' }) } catch { }
  }, 1000)
  try {
    if (next.type === 'analysisMarketing') {
      const marketingId = next.payload?.marketingId
      const result = {}
      const stepsEarly = [
        async () => ({ key: 'summary', value: await fetchMarketingOverdue({ marketingId, pembukuanId: next.payload?.pembukuanId }) }),
        async () => ({ key: 'transactions', value: await fetchMarketingOverdueTransactions({ marketingId, pembukuanId: next.payload?.pembukuanId }) }),
        async () => ({ key: 'distribution', value: await fetchMarketingProductDistribution({ marketingId, pembukuanId: next.payload?.pembukuanId }) }),
        async () => ({ key: 'completeness', value: await fetchMarketingCustomerCompleteness({ marketingId, pembukuanId: next.payload?.pembukuanId }) }),
      ]
      for (let i = 0; i < stepsEarly.length; i++) {
        const r = await stepsEarly[i]()
        result[r.key] = r.value
        next.progress = Math.round(((i + 1) / 7) * 90)
        await dbUpdateJobProgress(next.id, next.progress, 'in_progress')
        broadcastEvent({ type: 'job_progress', id: next.id, job_type: next.type, progress: next.progress, step: r.key, label: next.marketing_name ? `${next.marketing_name} • ${next.period_text || ''}` : next.period_text || '' })
      }
      const itemsRaw = await fetchMarketingProductItemsBatch({ marketingId, pembukuanId: next.payload?.pembukuanId })
      result['items'] = itemsRaw
      next.progress = Math.round((5 / 7) * 90)
      await dbUpdateJobProgress(next.id, next.progress, 'in_progress')
      broadcastEvent({ type: 'job_progress', id: next.id, job_type: next.type, progress: next.progress, step: 'items', label: next.marketing_name ? `${next.marketing_name} • ${next.period_text || ''}` : next.period_text || '' })
      const monthly = await fetchMarketingMonthlyTransactions({ marketingId, pembukuanId: next.payload?.pembukuanId })
      result['monthly'] = monthly
      next.progress = Math.round((6 / 7) * 90)
      await dbUpdateJobProgress(next.id, next.progress, 'in_progress')
      broadcastEvent({ type: 'job_progress', id: next.id, job_type: next.type, progress: next.progress, step: 'monthly', label: next.marketing_name ? `${next.marketing_name} • ${next.period_text || ''}` : next.period_text || '' })
      const allTransactions = await fetchMarketingTransactionsBasic({ marketingId, pembukuanId: next.payload?.pembukuanId })
      result['allTransactions'] = allTransactions
      next.progress = Math.round((7 / 7) * 90)
      await dbUpdateJobProgress(next.id, next.progress, 'in_progress')
      broadcastEvent({ type: 'job_progress', id: next.id, job_type: next.type, progress: next.progress, step: 'allTransactions', label: next.marketing_name ? `${next.marketing_name} • ${next.period_text || ''}` : next.period_text || '' })
      next.result = result
      const filePath = path.join(GENERATED_DIR, `${next.id}.json`)
      const payloadToSave = { id: next.id, type: next.type, payload: next.payload, created_at: next.created_at, finished_at: Date.now(), result: next.result }
      await fs.promises.writeFile(filePath, JSON.stringify(payloadToSave))
    } else {
      throw new Error('Unknown job type')
    }
    next.progress = 100
    next.status = 'completed'
    await dbUpdateJobCompleted(next.id, next.result)
  } catch (e) {
    next.error = e.message
    next.status = 'failed'
    await dbUpdateJobFailed(next.id, next.error)
  } finally {
    next.finished_at = Date.now()
    WORKING = false
    try { HEARTBEAT && clearInterval(HEARTBEAT); HEARTBEAT = null } catch { }
    broadcastEvent({ type: 'job_progress', id: next.id, job_type: next.type, progress: next.progress, label: next.marketing_name ? `${next.marketing_name} • ${next.period_text || ''}` : next.period_text || '' })
    broadcastEvent({ type: 'job_completed', id: next.id, status: next.status, error: next.error || null, job_type: next.type, label: next.marketing_name ? `${next.marketing_name} • ${next.period_text || ''}` : next.period_text || '' })
    setImmediate(runNext)
  }
}

function broadcastEvent(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`
  for (const client of EVENT_CLIENTS) {
    try { client.write(payload) } catch { }
  }
}

app.post('/api/jobs/queue', (req, res) => {
  try {
    const type = req.body?.type
    const payload = req.body?.payload || {}
    if (!type) return res.status(400).json({ error: 'type is required' })
    const id = enqueueJob({ type, payload })
    res.json({ id })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/jobs/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()
  res.write('retry: 2000\n\n')
  EVENT_CLIENTS.add(res)
  req.on('close', () => { EVENT_CLIENTS.delete(res) })
})

app.get('/api/jobs/:id', (req, res) => {
  const id = req.params.id
  dbGetJob(id).then(job => {
    if (!job) return res.status(404).json({ error: 'not found' })
    res.json({ job })
  }).catch(e => res.status(500).json({ error: e.message }))
})

app.get('/api/jobs', (req, res) => {
  dbListJobs().then(jobs => {
    res.json({ jobs, queue_size: QUEUE.length, working: WORKING })
  }).catch(e => res.status(500).json({ error: e.message }))
})

app.post('/api/jobs/run-next', (req, res) => {
  setImmediate(runNext)
  res.json({ ok: true })
})

app.delete('/api/jobs/:id', async (req, res) => {
  const id = req.params.id
  try {
    JOBS.delete(id)
    for (let i = QUEUE.length - 1; i >= 0; i--) { if (QUEUE[i]?.id === id) QUEUE.splice(i, 1) }
    await dbDeleteJob(id)
    try {
      const filePath = path.join(GENERATED_DIR, `${id}.json`)
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    } catch { }
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/reports/generated/:id', async (req, res) => {
  try {
    const id = req.params.id
    const filePath = path.join(GENERATED_DIR, `${id}.json`)
    const exists = fs.existsSync(filePath)
    if (!exists) return res.status(404).json({ error: 'not found' })
    const stat = await fs.promises.stat(filePath)
    const buf = await fs.promises.readFile(filePath)
    // Cache for 1 hour, allow browser to cache
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.setHeader('ETag', `"${stat.size}-${stat.mtimeMs}"`)
    res.setHeader('Content-Type', 'application/json')
    res.send(buf)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/reports/generated', async (req, res) => {
  try {
    const files = await fs.promises.readdir(GENERATED_DIR)
    const list = []
    for (const f of files) { if (!f.endsWith('.json')) continue; const st = await fs.promises.stat(path.join(GENERATED_DIR, f)); list.push({ id: f.replace('.json', ''), size: st.size, mtime: st.mtimeMs }) }
    list.sort((a, b) => b.mtime - a.mtime)
    res.json({ data: list })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/reports/regenerate/:id', async (req, res) => {
  try {
    const id = req.params.id
    const filePath = path.join(GENERATED_DIR, `${id}.json`)
    const exists = fs.existsSync(filePath)
    if (!exists) return res.status(404).json({ error: 'not found' })
    const json = JSON.parse(await fs.promises.readFile(filePath, 'utf-8'))
    const newId = enqueueJob({ type: json.type, payload: json.payload })
    res.json({ id: newId })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

export default app
