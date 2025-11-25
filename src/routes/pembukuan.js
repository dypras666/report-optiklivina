import { Router } from 'express'
import { getActivePembukuan, listPembukuan } from '../services/pembukuanService.js'

const router = Router()

router.get('/active', async (req, res) => {
  try {
    const pembukuanId = req.query.id ? parseInt(req.query.id, 10) : undefined
    const active = await getActivePembukuan(pembukuanId)
    res.json({ data: active })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/list', async (req, res) => {
  try {
    const data = await listPembukuan()
    res.json({ data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router