import { Router } from 'express'
import { fetchTokoReports, fetchTokoTransaksiReports } from '../services/reportsService.js'

const router = Router()

router.get('/toko', async (req, res) => {
  try {
    const pembukuanId = req.query.pembukuan_id ? parseInt(req.query.pembukuan_id, 10) : undefined
    const cabangId = req.query.cabang ? parseInt(req.query.cabang, 10) : undefined
    const page = req.query.page ? parseInt(req.query.page, 10) : 1
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50
    const { data, total } = await fetchTokoReports({ pembukuanId, cabangId, page, limit })
    res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total/limit) } })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/toko/transaksi', async (req, res) => {
  try {
    const pembukuanId = req.query.pembukuan_id ? parseInt(req.query.pembukuan_id, 10) : undefined
    const cabangId = req.query.cabang ? parseInt(req.query.cabang, 10) : undefined
    const page = req.query.page ? parseInt(req.query.page, 10) : 1
    const limitRaw = req.query.limit
    const limit = limitRaw === 'all' ? 0 : (limitRaw ? parseInt(limitRaw, 10) : 50)
    const q = req.query.q || undefined
    const status = req.query.status || undefined
    const { data, total } = await fetchTokoTransaksiReports({ pembukuanId, cabangId, page, limit, q, status })
    res.json({ data, meta: { page, limit, total, totalPages: limit>0 ? Math.ceil(total/limit) : 1 } })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router