import { Router } from 'express'
import { fetchOmsetToko, fetchOmsetTokoDay, fetchOmsetTokoDayItems, fetchOmsetTokoItemsPeriod, fetchCabangAnalysis, fetchCabangAnalysisAll } from '../services/reportsService.js'

const router = Router()

router.get('/toko', async (req, res) => {
  try {
    const pembukuanId = req.query.pembukuan_id ? parseInt(req.query.pembukuan_id, 10) : undefined
    const cabangId = req.query.cabang ? parseInt(req.query.cabang, 10) : undefined
    const page = req.query.page ? parseInt(req.query.page, 10) : 1
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50
    const { data, total } = await fetchOmsetToko({ pembukuanId, cabangId, page, limit })
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total/limit) } })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/toko/day', async (req, res) => {
  try {
    const tanggal = req.query.tanggal || ''
    const cabangId = req.query.cabang ? parseInt(req.query.cabang, 10) : undefined
    const page = req.query.page ? parseInt(req.query.page, 10) : 1
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50
    const { data, total } = await fetchOmsetTokoDay({ tanggal, cabangId, page, limit })
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total/(limit||1)) } })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/toko/day/items', async (req, res) => {
  try {
    const tanggal = req.query.tanggal || ''
    const cabangId = req.query.cabang ? parseInt(req.query.cabang, 10) : undefined
    const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(tanggal)
    if (!isValidDate || !cabangId) {
      return res.status(400).json({ error: 'tanggal and cabang are required' })
    }
    const data = await fetchOmsetTokoDayItems({ tanggal, cabangId })
    res.json({ data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/toko/items', async (req, res) => {
  try {
    const pembukuanId = req.query.pembukuan_id ? parseInt(req.query.pembukuan_id, 10) : undefined
    const cabangId = req.query.cabang ? parseInt(req.query.cabang, 10) : undefined
    if (!pembukuanId || !cabangId) {
      return res.status(400).json({ error: 'pembukuan_id and cabang are required' })
    }
    const data = await fetchOmsetTokoItemsPeriod({ pembukuanId, cabangId })
    res.json({ data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/analysis', async (req, res) => {
  try {
    const pembukuanId = req.query.pembukuan_id ? parseInt(req.query.pembukuan_id, 10) : undefined
    const cabangId = req.query.cabang ? parseInt(req.query.cabang, 10) : undefined
    if (!pembukuanId || !cabangId) {
      return res.status(400).json({ error: 'pembukuan_id and cabang are required' })
    }
    const data = await fetchCabangAnalysis({ pembukuanId, cabangId })
    res.json({ data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/analysis-cabang', async (req, res) => {
  try {
    const pembukuanId = req.query.pembukuan_id ? parseInt(req.query.pembukuan_id, 10) : undefined
    if (!pembukuanId) {
      return res.status(400).json({ error: 'pembukuan_id is required' })
    }
    const data = await fetchCabangAnalysisAll({ pembukuanId })
    res.json({ data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router