import { Router } from 'express'
import { fetchMarketingProductDistribution, fetchMarketingCustomerCompleteness, fetchMarketingProductItems, fetchMarketingMonthlyTransactions, fetchMarketingTransactionsBasic } from '../services/reportsService.js'

const router = Router()

router.get('/marketing/product-distribution', async (req, res) => {
  try {
    const marketingId = req.query.marketing ? Number(req.query.marketing) : undefined
    const cabangId = req.query.cabang ? Number(req.query.cabang) : undefined
    const data = await fetchMarketingProductDistribution({ marketingId, cabangId })
    res.json({ data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router

router.get('/marketing/customer-completeness', async (req, res) => {
  try {
    const marketingId = req.query.marketing ? Number(req.query.marketing) : undefined
    if(!marketingId) return res.status(400).json({ error: 'marketing is required' })
    const data = await fetchMarketingCustomerCompleteness({ marketingId })
    res.json({ data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/marketing/items', async (req, res) => {
  try {
    const marketingId = req.query.marketing ? Number(req.query.marketing) : undefined
    if(!marketingId) return res.status(400).json({ error: 'marketing is required' })
    const data = await fetchMarketingProductItems({ marketingId })
    res.json({ data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/marketing/monthly-transactions', async (req, res) => {
  try {
    const marketingId = req.query.marketing ? Number(req.query.marketing) : undefined
    if(!marketingId) return res.status(400).json({ error: 'marketing is required' })
    const data = await fetchMarketingMonthlyTransactions({ marketingId })
    res.json({ data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/marketing/transactions', async (req, res) => {
  try {
    const marketingId = req.query.marketing ? Number(req.query.marketing) : undefined
    if(!marketingId) return res.status(400).json({ error: 'marketing is required' })
    const data = await fetchMarketingTransactionsBasic({ marketingId })
    res.json({ data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})