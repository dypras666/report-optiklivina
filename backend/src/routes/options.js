import { Router } from 'express'
import { listMarketing, listCabang } from '../services/optionsService.js'

const router = Router()

router.get('/marketing', async (req, res) => {
  try {
    const q = req.query.q || ''
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 1000
    const cabangId = req.query.cabangId || ''
    const data = await listMarketing({ q, limit, cabangId })
    res.json({ data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/cabang', async (req, res) => {
  try {
    const q = req.query.q || ''
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50
    const data = await listCabang({ q, limit })
    res.json({ data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router