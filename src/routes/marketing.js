import { Router } from 'express'
import { fetchMarketingReports, fetchMarketingItems, fetchMarketingItemsPeriod, fetchMarketingOverdue, fetchMarketingOverdueTransactions, fetchMarketingReportsByPaymentPeriod, fetchMarketingTransactionHeader, fetchMarketingProductItemsCorePage, enrichProductRows, countMarketingProductItems } from '../services/reportsService.js'

const router = Router()

router.get('/marketing', async (req, res) => {
  try {
    const pembukuanId = req.query.pembukuan_id ? parseInt(req.query.pembukuan_id, 10) : undefined
    const marketingId = req.query.marketing ? parseInt(req.query.marketing, 10) : undefined
    const cabangId = req.query.cabang ? parseInt(req.query.cabang, 10) : undefined
    const page = req.query.page ? parseInt(req.query.page, 10) : 1
    const limitRaw = req.query.limit
    const limit = limitRaw === 'all' ? 0 : (limitRaw ? parseInt(limitRaw, 10) : 20)
    const includeSums = req.query.include_sums === '1'
    const q = req.query.q || undefined
    const status = req.query.status || undefined
    const { data, total, sums } = await fetchMarketingReports({ pembukuanId, marketingId, cabangId, page, limit, includeSums, q, status })
    res.json({ data, meta: { page, limit, total, totalPages: limit>0 ? Math.ceil(total/limit) : 1, sums } })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/marketing-payments', async (req, res) => {
  try {
    const pembukuanId = req.query.pembukuan_id ? parseInt(req.query.pembukuan_id, 10) : undefined
    const marketingId = req.query.marketing ? parseInt(req.query.marketing, 10) : undefined
    const cabangId = req.query.cabang ? parseInt(req.query.cabang, 10) : undefined
    const page = req.query.page ? parseInt(req.query.page, 10) : 1
    const limitRaw = req.query.limit
    const limit = limitRaw === 'all' ? 0 : (limitRaw ? parseInt(limitRaw, 10) : 20)
    const includeSums = req.query.include_sums === '1'
    const q = req.query.q || undefined
    const status = req.query.status || undefined
    const { data, total, sums } = await fetchMarketingReportsByPaymentPeriod({ pembukuanId, marketingId, cabangId, page, limit, includeSums, q, status })
    res.json({ data, meta: { page, limit, total, totalPages: limit>0 ? Math.ceil(total/limit) : 1, sums } })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/marketing-overdue', async (req, res) => {
  try {
    const cabangId = req.query.cabang ? parseInt(req.query.cabang, 10) : undefined
    const marketingId = req.query.marketing ? parseInt(req.query.marketing, 10) : undefined
    const status = req.query.status || undefined
    const { data } = await fetchMarketingOverdue({ cabangId, marketingId, status })
    res.json({ data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/marketing-overdue/transactions', async (req, res) => {
  try {
    const cabangId = req.query.cabang ? parseInt(req.query.cabang, 10) : undefined
    const marketingId = req.query.marketing ? parseInt(req.query.marketing, 10) : undefined
    const status = req.query.status || undefined
    const { data } = await fetchMarketingOverdueTransactions({ cabangId, marketingId, status })
    res.json({ data })
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

router.get('/marketing/transaction/:kode', async (req, res) => {
  try {
    const { kode } = req.params
    const data = await fetchMarketingTransactionHeader(kode)
    res.json({ data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/marketing/items', async (req, res) => {
  try {
    const pembukuanId = req.query.pembukuan_id ? parseInt(req.query.pembukuan_id, 10) : undefined
    const cabangId = req.query.cabang ? parseInt(req.query.cabang, 10) : undefined
    if (!pembukuanId || !cabangId) {
      return res.status(400).json({ error: 'pembukuan_id and cabang are required' })
    }
    const data = await fetchMarketingItemsPeriod({ pembukuanId, cabangId })
    res.json({ data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/marketing/items/page', async (req, res) => {
  try{
    const pembukuanId = req.query.pembukuan_id ? parseInt(req.query.pembukuan_id, 10) : undefined
    const cabangId = req.query.cabang ? parseInt(req.query.cabang, 10) : undefined
    const marketingId = req.query.marketing ? parseInt(req.query.marketing, 10) : undefined
    const page = req.query.page ? parseInt(req.query.page, 10) : 1
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20
    if (!pembukuanId) return res.status(400).json({ error: 'pembukuan_id is required' })
    const offset = Math.max(0, (Number(page) - 1) * Number(limit))
    const core = await fetchMarketingProductItemsCorePage({ marketingId, pembukuanId, cabangId, limit, offset })
    const data = await enrichProductRows(core)
    const total = await countMarketingProductItems({ marketingId, pembukuanId, cabangId })
    res.json({ data, meta: { page, limit, total, totalPages: limit>0 ? Math.ceil(total/limit) : 1 } })
  }catch(e){ res.status(500).json({ error: e.message }) }
})

export default router