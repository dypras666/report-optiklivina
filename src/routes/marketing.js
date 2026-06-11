import { Router } from 'express'
import { pool } from '../db.js'
import { fetchMarketingReports, fetchMarketingItems, fetchMarketingItemsPeriod, fetchMarketingOverdue, fetchMarketingOverdueTransactions, fetchMarketingReportsByPaymentPeriod, fetchMarketingTransactionHeader, fetchMarketingProductItemsCorePage, enrichProductRows, countMarketingProductItems, fetchLowDPTransactions, fetchVoucherPayments, fetchSponsors, fetchSponsorsByMarketing, fetchTransactionFullDetails, fetchCollectorPayments, fetchSponsoredChildren, fetchVoucherPaymentsList, rollbackVoucherPayment, approveVoucherPayment, rejectVoucherPayment } from '../services/reportsService.js'

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
    res.json({ data, meta: { page, limit, total, totalPages: limit > 0 ? Math.ceil(total / limit) : 1, sums } })
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
    res.json({ data, meta: { page, limit, total, totalPages: limit > 0 ? Math.ceil(total / limit) : 1, sums } })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/marketing-voucher', async (req, res) => {
  try {
    const pembukuanId = req.query.pembukuan_id ? parseInt(req.query.pembukuan_id, 10) : undefined
    const cabangId = req.query.cabang ? parseInt(req.query.cabang, 10) : undefined
    const page = req.query.page ? parseInt(req.query.page, 10) : 1
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20
    const q = req.query.q || undefined
    const { data, total } = await fetchVoucherPayments({ pembukuanId, cabangId, page, limit, q })
    res.json({ data, meta: { page, limit, total, totalPages: limit > 0 ? Math.ceil(total / limit) : 1 } })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/sponsors', async (req, res) => {
  try {
    const cabangId = req.query.cabang ? parseInt(req.query.cabang, 10) : undefined
    const marketingId = req.query.marketing ? parseInt(req.query.marketing, 10) : undefined
    const page = req.query.page ? parseInt(req.query.page, 10) : 1
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20
    const q = req.query.q || undefined
    const { data, total } = await fetchSponsors({ cabangId, marketingId, page, limit, q })
    res.json({ data, meta: { page, limit, total, totalPages: limit > 0 ? Math.ceil(total / limit) : 1 } })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/sponsors/marketing', async (req, res) => {
  try {
    const cabangId = req.query.cabang ? parseInt(req.query.cabang, 10) : undefined
    const page = req.query.page ? parseInt(req.query.page, 10) : 1
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20
    const q = req.query.q || undefined
    const { data, total } = await fetchSponsorsByMarketing({ cabangId, page, limit, q })
    res.json({ data, meta: { page, limit, total, totalPages: limit > 0 ? Math.ceil(total / limit) : 1 } })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/sponsors/children/:kode', async (req, res) => {
  try {
    const { kode } = req.params
    const data = await fetchSponsoredChildren({ sponsorKode: kode })
    res.json({ data })
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

router.get('/marketing/:kode/details', async (req, res) => {
  try {
    const { kode } = req.params
    const items = await fetchMarketingItems(kode)

    // Fetch payments for this transaction
    const [paymentRows] = await pool.query(`
      SELECT 
        tp.id_pembayaran,
        tp.kode_transaksi,
        tp.jumlah_bayar,
        tp.tanggal_bayar,
        tp.jenis_transaksi,
        tp.metode_setor,
        tp.id_rekening_setor,
        tk.keterangan_status AS catatan_bayar
      FROM transaksi_pembayaran tp
        LEFT JOIN transaksi_kolektor tk ON tk.kode_transaksi = tp.kode_transaksi
      WHERE tp.kode_transaksi = ?
      ORDER BY tp.tanggal_bayar DESC, tp.id_pembayaran DESC
    `, [kode])

    // Fetch transaction summary
    const [transRows] = await pool.query(`
      SELECT 
        t.kode_transaksi,
        t.tanggal_order,
        (CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) AS total_harga,
        COALESCE(SUM(tp.jumlah_bayar), 0) AS total_bayar,
        ((CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) - COALESCE(SUM(tp.jumlah_bayar), 0)) AS sisa_bayar
      FROM transaksi t
        LEFT JOIN transaksi_pembayaran tp ON tp.kode_transaksi = t.kode_transaksi
      WHERE t.kode_transaksi = ?
      GROUP BY t.kode_transaksi, t.tanggal_order, t.harga_nego, t.total_harga
    `, [kode])

    res.json({
      items,
      payments: paymentRows,
      summary: transRows[0] || null
    })
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
  try {
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
    res.json({ data, meta: { page, limit, total, totalPages: limit > 0 ? Math.ceil(total / limit) : 1 } })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Laporan DP dibawah 20%
router.get('/marketing-low-dp', async (req, res) => {
  try {
    const pembukuanId = req.query.pembukuan_id ? parseInt(req.query.pembukuan_id, 10) : undefined
    const marketingId = req.query.marketing ? parseInt(req.query.marketing, 10) : undefined
    const cabangId = req.query.cabang ? parseInt(req.query.cabang, 10) : undefined
    const page = req.query.page ? parseInt(req.query.page, 10) : 1
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20
    const q = req.query.q || undefined
    if (!pembukuanId) return res.status(400).json({ error: 'pembukuan_id is required' })
    const { data, total, summary } = await fetchLowDPTransactions({ pembukuanId, marketingId, cabangId, page, limit, q })
    res.json({ data, summary, meta: { page, limit, total, totalPages: limit > 0 ? Math.ceil(total / limit) : 1 } })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/collector-payments', async (req, res) => {
  try {
    const pembukuanId = req.query.pembukuan_id ? parseInt(req.query.pembukuan_id, 10) : undefined
    const page = req.query.page ? parseInt(req.query.page, 10) : 1
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20
    const q = req.query.q || undefined
    if (!pembukuanId) return res.status(400).json({ error: 'pembukuan_id is required' })
    const { data, total } = await fetchCollectorPayments({ pembukuanId, page, limit, q })
    res.json({ data, meta: { page, limit, total, totalPages: limit > 0 ? Math.ceil(total / limit) : 1 } })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})


router.get('/transaction/full/:kode', async (req, res) => {
  try {
    const { kode } = req.params

    const data = await fetchTransactionFullDetails(kode)
    if (!data.header) return res.status(404).json({ error: 'Transaction not found' })
    res.json({ data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/pending-voucher', async (req, res) => {
  try {
    const cabangId = req.query.cabang ? parseInt(req.query.cabang, 10) : undefined
    const page = req.query.page ? parseInt(req.query.page, 10) : 1
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20
    const q = req.query.q || undefined
    const status = req.query.status || 'pending'
    const { data, total, summary } = await fetchVoucherPaymentsList({ cabangId, page, limit, q, status })
    res.json({ data, meta: { page, limit, total, totalPages: limit > 0 ? Math.ceil(total / limit) : 1, summary } })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/approve-voucher/:id', async (req, res) => {
  try {
    const { id } = req.params
    await approveVoucherPayment(id)
    res.json({ status: true, msg: 'Voucher berhasil di-approve' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/reject-voucher/:id', async (req, res) => {
  try {
    const { id } = req.params
    await rejectVoucherPayment(id)
    res.json({ status: true, msg: 'Voucher berhasil ditolak' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/rollback-voucher/:id', async (req, res) => {
  try {
    const { id } = req.params
    await rollbackVoucherPayment(id)
    res.json({ status: true, msg: 'Pembayaran berhasil di-rollback ke pending' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router