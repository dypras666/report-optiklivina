import { Router } from 'express'
import { fetchOmsetToko, fetchProfitLossDetails } from '../services/reportsService.js'
import { fetchProfitLossReport, fetchProfitLossByCabang, upsertProfitLossToSupabase, fetchProfitLossFromSupabase, compareWithPrevious } from '../services/profitLossService.js'
import customersRouter from './customers.js'
import marketingRouter from './marketing.js'
import tokoRouter from './toko.js'
import asetRouter from './aset.js'

const router = Router()
router.use('/', customersRouter)
router.use('/', marketingRouter)
router.use('/', tokoRouter)
router.use('/', asetRouter)

// Compatibility route used by frontend for omset in reports base
router.get('/omset-toko', async (req, res) => {
  try {
    const pembukuanId = req.query.pembukuan_id ? parseInt(req.query.pembukuan_id, 10) : undefined
    const cabangId = req.query.cabang ? parseInt(req.query.cabang, 10) : undefined
    const page = req.query.page ? parseInt(req.query.page, 10) : 1
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50
    const { data, total } = await fetchOmsetToko({ pembukuanId, cabangId, page, limit })
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / (limit || 1)) } })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/aset/idle', async (req, res) => {
  try {
    const cabangId = req.query.cabang ? parseInt(req.query.cabang, 10) : undefined
    const months = req.query.months ? parseInt(req.query.months, 10) : 3
    if (!cabangId) return res.status(400).json({ error: 'cabang is required' })
    const { data, summary } = await fetchAsetIdle({ cabangId, months })
    res.json({ data, summary })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/laba-rugi', async (req, res) => {
  try {
    const pembukuanId = req.query.pembukuan_id ? parseInt(req.query.pembukuan_id, 10) : undefined
    const cabangId = req.query.cabang ? parseInt(req.query.cabang, 10) : undefined
    const marketingId = req.query.marketing ? parseInt(req.query.marketing, 10) : undefined
    const data = await fetchProfitLossReport({ pembukuanId, cabangId, marketingId })
    res.json({ data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/laba-rugi/by-cabang', async (req, res) => {
  try {
    const pembukuanId = req.query.pembukuan_id ? parseInt(req.query.pembukuan_id, 10) : undefined
    const data = await fetchProfitLossByCabang({ pembukuanId })
    res.json({ data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/laba-rugi/details', async (req, res) => {
  try {
    const pembukuanId = req.query.pembukuan_id ? parseInt(req.query.pembukuan_id, 10) : undefined
    const cabangId = req.query.cabang ? parseInt(req.query.cabang, 10) : undefined
    const data = await fetchProfitLossDetails({ pembukuanId, cabangId })
    res.json({ data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/laba-rugi/supabase/save', async (req, res) => {
  try {
    const pembukuanId = req.body?.pembukuan_id ? parseInt(req.body.pembukuan_id, 10) : (req.query.pembukuan_id ? parseInt(req.query.pembukuan_id, 10) : undefined)
    const cabangId = req.body?.cabang ? parseInt(req.body.cabang, 10) : (req.query.cabang ? parseInt(req.query.cabang, 10) : undefined)
    const marketingId = req.body?.marketing ? parseInt(req.body.marketing, 10) : (req.query.marketing ? parseInt(req.query.marketing, 10) : undefined)
    if (!pembukuanId) return res.status(400).json({ error: 'pembukuan_id is required' })
    const data = await upsertProfitLossToSupabase({ pembukuanId, cabangId, marketingId })
    res.json({ data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/laba-rugi/supabase/get', async (req, res) => {
  try {
    const pembukuanId = req.query.pembukuan_id ? parseInt(req.query.pembukuan_id, 10) : undefined
    const cabangId = req.query.cabang ? parseInt(req.query.cabang, 10) : undefined
    const marketingId = req.query.marketing ? parseInt(req.query.marketing, 10) : undefined
    if (!pembukuanId) return res.status(400).json({ error: 'pembukuan_id is required' })
    const data = await fetchProfitLossFromSupabase({ pembukuanId, cabangId, marketingId })
    res.json({ data: data?.data || null })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/laba-rugi/compare-previous', async (req, res) => {
  try {
    const pembukuanId = req.query.pembukuan_id ? parseInt(req.query.pembukuan_id, 10) : undefined
    const cabangId = req.query.cabang ? parseInt(req.query.cabang, 10) : undefined
    const marketingId = req.query.marketing ? parseInt(req.query.marketing, 10) : undefined
    if (!pembukuanId) return res.status(400).json({ error: 'pembukuan_id is required' })
    const data = await compareWithPrevious({ pembukuanId, cabangId, marketingId })
    res.json({ data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/aset/idle-summary', async (req, res) => {
  try {
    const months = req.query.months ? parseInt(req.query.months, 10) : 3
    const { summary } = await fetchAsetIdleSummaryAll({ months })
    res.json({ summary })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})



router.get('/omset-toko', async (req, res) => {
  try {
    const pembukuanId = req.query.pembukuan_id ? parseInt(req.query.pembukuan_id, 10) : undefined
    const cabangId = req.query.cabang ? parseInt(req.query.cabang, 10) : undefined
    const page = req.query.page ? parseInt(req.query.page, 10) : 1
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50
    const { data, total } = await fetchOmsetToko({ pembukuanId, cabangId, page, limit })
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / (limit || 1)) } })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/marketing/:kode/items', async (req, res) => {
  try {
    const { kode } = req.params
    const data = await fetchMarketingItems(kode)
    res.json({ data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router