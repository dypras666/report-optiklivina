import Collector from '../models/Collector.js'

class CollectorController {
    /**
     * Create a new collector account
     * POST /api/collectors/create
     */
    static async createCollector(req, res) {
        try {
            const { username, password, nama_lengkap, id_cabang } = req.body

            // Validation
            if (!username || !password || !nama_lengkap) {
                return res.status(400).json({
                    error: 'Username, password, and nama_lengkap are required'
                })
            }

            // Check if username already exists
            const exists = await Collector.usernameExists(username)
            if (exists) {
                return res.status(400).json({
                    error: 'Username already exists'
                })
            }

            // Create collector
            const id = await Collector.createCollector({
                username,
                password,
                nama_lengkap,
                id_cabang
            })

            res.status(201).json({
                success: true,
                message: 'Collector account created successfully',
                data: { id }
            })
        } catch (error) {
            console.error('[CollectorController] Create error:', error)
            res.status(500).json({
                error: 'Failed to create collector account',
                details: error.message
            })
        }
    }

    /**
     * Get all collectors with pagination
     * GET /api/collectors
     */
    static async getCollectors(req, res) {
        try {
            const page = parseInt(req.query.page) || 1
            const limit = parseInt(req.query.limit) || 20
            const q = req.query.q || ''

            const result = await Collector.getCollectors({ page, limit, q })

            res.json(result)
        } catch (error) {
            console.error('[CollectorController] Get collectors error:', error)
            res.status(500).json({
                error: 'Failed to fetch collectors',
                details: error.message
            })
        }
    }

    /**
     * Get collector by ID
     * GET /api/collectors/:id
     */
    static async getCollectorById(req, res) {
        try {
            const id = parseInt(req.params.id)

            if (!id) {
                return res.status(400).json({ error: 'Invalid collector ID' })
            }

            const collector = await Collector.getCollectorById(id)

            if (!collector) {
                return res.status(404).json({ error: 'Collector not found' })
            }

            res.json({ data: collector })
        } catch (error) {
            console.error('[CollectorController] Get collector error:', error)
            res.status(500).json({
                error: 'Failed to fetch collector',
                details: error.message
            })
        }
    }

    /**
     * Update collector information
     * PUT /api/collectors/:id
     */
    static async updateCollector(req, res) {
        try {
            const id = parseInt(req.params.id)
            const { nama_lengkap, id_cabang, password } = req.body

            if (!id) {
                return res.status(400).json({ error: 'Invalid collector ID' })
            }

            const success = await Collector.updateCollector(id, {
                nama_lengkap,
                id_cabang,
                password
            })

            if (!success) {
                return res.status(404).json({ error: 'Collector not found or no changes made' })
            }

            res.json({
                success: true,
                message: 'Collector updated successfully'
            })
        } catch (error) {
            console.error('[CollectorController] Update error:', error)
            res.status(500).json({
                error: 'Failed to update collector',
                details: error.message
            })
        }
    }

    /**
     * Deactivate collector account
     * DELETE /api/collectors/:id
     */
    static async deactivateCollector(req, res) {
        try {
            const id = parseInt(req.params.id)

            if (!id) {
                return res.status(400).json({ error: 'Invalid collector ID' })
            }

            const success = await Collector.deactivateCollector(id)

            if (!success) {
                return res.status(404).json({ error: 'Collector not found' })
            }

            res.json({
                success: true,
                message: 'Collector deactivated successfully'
            })
        } catch (error) {
            console.error('[CollectorController] Deactivate error:', error)
            res.status(500).json({
                error: 'Failed to deactivate collector',
                details: error.message
            })
        }
    }

    /**
     * Activate collector account
     * POST /api/collectors/:id/activate
     */
    static async activateCollector(req, res) {
        try {
            const id = parseInt(req.params.id)

            if (!id) {
                return res.status(400).json({ error: 'Invalid collector ID' })
            }

            const success = await Collector.activateCollector(id)

            if (!success) {
                return res.status(404).json({ error: 'Collector not found' })
            }

            res.json({
                success: true,
                message: 'Collector activated successfully'
            })
        } catch (error) {
            console.error('[CollectorController] Activate error:', error)
            res.status(500).json({
                error: 'Failed to activate collector',
                details: error.message
            })
        }
    }
}

export default CollectorController
