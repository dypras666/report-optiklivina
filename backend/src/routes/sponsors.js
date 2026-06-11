import { Router } from 'express'
import { fetchApprovals, updateApproval } from '../services/sponsorsService.js'

const router = Router()

// GET /api/sponsors/approvals
router.get('/approvals', async (req, res) => {
    try {
        const { cabangId, marketingId, pembukuanId, page, pageSize, search, orderCol, orderDir } = req.query
        const limit = Number(pageSize) || 0
        const offset = (Number(page) || 0) * limit

        const result = await fetchApprovals({
            cabangId,
            marketingId,
            pembukuanId,
            limit,
            offset,
            search,
            orderCol,
            orderDir
        })

        res.json(result)
    } catch (error) {
        console.error('Fetch Approvals Error:', error)
        res.status(500).json({ error: error.message })
    }
})

// POST /api/sponsors/approvals/:kode
router.post('/approvals/:kode', async (req, res) => {
    try {
        const kode_customer = req.params.kode
        const { action } = req.body // 1 (pending), 2 (acc), 3 (tolak)

        if (!kode_customer || !action) {
            return res.status(400).json({ error: 'Kode customer and action are required' })
        }

        const success = await updateApproval({ kode_customer, action })
        if (success) {
            res.json({ ok: true })
        } else {
            res.status(404).json({ error: 'Customer not found or not updated' })
        }
    } catch (error) {
        console.error('Update Approval Error:', error)
        res.status(500).json({ error: error.message })
    }
})

// Bulk action (optional convenience)
router.post('/approvals/bulk', async (req, res) => {
    try {
        const { kodes, action } = req.body
        if (!Array.isArray(kodes) || !action) {
            return res.status(400).json({ error: 'Array of customer kodes and action are required' })
        }

        let successCount = 0
        for (const kode of kodes) {
            const success = await updateApproval({ kode_customer: kode, action })
            if (success) count++
        }

        res.json({ ok: true, count: successCount })
    } catch (error) {
        console.error('Bulk Update Approval Error:', error)
        res.status(500).json({ error: error.message })
    }
})

export default router
