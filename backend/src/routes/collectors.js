import express from 'express'
import CollectorController from '../controllers/CollectorController.js'

const router = express.Router()

// Create new collector
router.post('/create', CollectorController.createCollector)

// Get all collectors
router.get('/', CollectorController.getCollectors)

// Get collector by ID
router.get('/:id', CollectorController.getCollectorById)

// Update collector
router.put('/:id', CollectorController.updateCollector)

// Deactivate collector
router.delete('/:id', CollectorController.deactivateCollector)

// Activate collector
router.post('/:id/activate', CollectorController.activateCollector)

export default router
