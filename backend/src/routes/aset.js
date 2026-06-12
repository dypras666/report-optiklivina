import { Router } from 'express'
import { fetchAsetReport, fetchAsetReportAllCabang, fetchAsetIdle, fetchAsetReportLight, fetchAsetIdleSummaryAll, upsertAssetStatus, deleteAssetStatus, getAssetStatus } from '../services/reportsService.js'
import { fetchProductTransactionsPage } from '../services/productTransactionsService.js'
import { fetchMasterItemsES } from '../services/masterItemsService.js'

const router = Router()

router.get('/aset', async (req, res) => {
  try {
    const cabangId = req.query.cabang ? parseInt(req.query.cabang, 10) : undefined
    const light = req.query.light === '1'
    if (cabangId) {
      const { data, summary } = light ? await fetchAsetReportLight({ cabangId }) : await fetchAsetReport({ cabangId })
      res.json({ data, summary })
    } else {
      const includeIdle = req.query.include_idle === '1'
      const months = req.query.months ? parseInt(req.query.months, 10) : undefined
      const { list, summary } = await fetchAsetReportAllCabang({ includeIdle, months })
      res.json({ data: list, summary })
    }
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

router.get('/aset/idle-summary', async (req, res) => {
  try {
    const months = req.query.months ? parseInt(req.query.months, 10) : 3
    const { summary } = await fetchAsetIdleSummaryAll({ months })
    res.json({ summary })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/aset/master', async (req, res) => {
  try{
    const jenis = String(req.query?.jenis||'').toLowerCase()
    const page = req.query.page ? parseInt(req.query.page, 10) : 1
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20
    const q = req.query.q || undefined
    const status = (req.query.status === '0' || req.query.status === '1') ? parseInt(req.query.status, 10) : undefined
    const order = (req.query.order==='qty' || req.query.order==='uang') ? req.query.order : undefined
    const soldOnly = req.query.sold_only === '1'
    const cabangId = req.query.cabang ? parseInt(req.query.cabang, 10) : undefined
    const ready = req.query.ready
    const { data, meta } = await fetchMasterItemsES({ jenis, page, limit, q, status, order, soldOnly, cabangId, ready })
    res.json({ data, meta })
  }catch(e){ res.status(500).json({ error: e.message }) }
})

export default router

router.post('/aset/status', async (req, res) => {
  try{
    const jenis = String(req.body?.jenis||'').toLowerCase()
    const id = parseInt(req.body?.id, 10)
    const status = parseInt(req.body?.status, 10)
    const allowed = new Set(['katalog','softlens','frame','lensa'])
    if (!allowed.has(jenis)) return res.status(400).json({ error: 'jenis invalid' })
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'id invalid' })
    if (!(status===0 || status===1)) return res.status(400).json({ error: 'status invalid' })
    const r = await upsertAssetStatus({ jenis, productId: id, status })
    res.json({ ok: true, data: r })
  }catch(e){ res.status(500).json({ error: e.message }) }
})

router.delete('/aset/status/:jenis/:id', async (req, res) => {
  try{
    const jenis = String(req.params?.jenis||'').toLowerCase()
    const id = parseInt(req.params?.id, 10)
    const allowed = new Set(['katalog','softlens','frame','lensa'])
    if (!allowed.has(jenis)) return res.status(400).json({ error: 'jenis invalid' })
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'id invalid' })
    const r = await deleteAssetStatus({ jenis, productId: id })
    res.json({ ok: true, data: r })
  }catch(e){ res.status(500).json({ error: e.message }) }
})

router.get('/aset/status/:jenis/:id', async (req, res) => {
  try{
    const jenis = String(req.params?.jenis||'').toLowerCase()
    const id = parseInt(req.params?.id, 10)
    const allowed = new Set(['katalog','softlens','frame','lensa'])
    if (!allowed.has(jenis)) return res.status(400).json({ error: 'jenis invalid' })
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'id invalid' })
    const r = await getAssetStatus({ jenis, productId: id })
    res.json({ ok: true, data: r })
  }catch(e){ res.status(500).json({ error: e.message }) }
})

router.get('/aset/product/:jenis/:id/transactions', async (req, res) => {
  try{
    const jenis = String(req.params?.jenis||'').toLowerCase()
    const id = parseInt(req.params?.id, 10)
    const page = req.query.page ? parseInt(req.query.page, 10) : 1
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20
    const cabangId = req.query.cabang ? parseInt(req.query.cabang, 10) : undefined
    const pembukuanId = req.query.pembukuan_id ? parseInt(req.query.pembukuan_id, 10) : undefined
    const all = req.query.all === '1'
    const split = req.query.split === '1'
    const page_mkt = req.query.page_mkt ? parseInt(req.query.page_mkt, 10) : page
    const limit_mkt = req.query.limit_mkt ? parseInt(req.query.limit_mkt, 10) : limit
    const page_toko = req.query.page_toko ? parseInt(req.query.page_toko, 10) : page
    const limit_toko = req.query.limit_toko ? parseInt(req.query.limit_toko, 10) : limit
    const allowed = new Set(['katalog','softlens','frame','lensa'])
    if (!allowed.has(jenis)) return res.status(400).json({ error: 'jenis invalid' })
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'id invalid' })
    const out = await fetchProductTransactionsPage({ jenis, productId: id, cabangId, page, limit, pembukuanId, all, split, page_mkt, limit_mkt, page_toko, limit_toko })
    res.json(out)
  }catch(e){ res.status(500).json({ error: e.message }) }
})
