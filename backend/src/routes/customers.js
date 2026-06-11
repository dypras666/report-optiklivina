import { Router } from 'express'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import { pool } from '../db.js'
import { fetchCustomerProfileByTrans, fetchCustomerProfileByCode, fetchCustomerSummaryByCode, fetchCustomers, fetchCustomerStats } from '../services/reportsService.js'
import ExcelJS from 'exceljs'

const router = Router()

router.get('/customer/profile/:kode', async (req, res) => {
  try {
    const { kode } = req.params
    const data = await fetchCustomerProfileByTrans({ kode })
    res.json({ data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/customer/profile-by-code/:kode', async (req, res) => {
  try {
    const { kode } = req.params
    const data = await fetchCustomerProfileByCode({ kode })
    res.json({ data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/customer/summary/:kode', async (req, res) => {
  try {
    const { kode } = req.params
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50
    const { profile, transactions, points, points_used_list, payments, warranty_claims } = await fetchCustomerSummaryByCode({ kode, limit })
    res.json({ profile, transactions, points, points_used_list, payments, warranty_claims })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/customers', async (req, res) => {
  try {
    const page = req.query.page ? parseInt(req.query.page, 10) : 1
    const limitRaw = req.query.limit
    const limit = limitRaw === 'all' ? 0 : (limitRaw ? parseInt(limitRaw, 10) : 20)
    const cabangId = req.query.cabang ? parseInt(req.query.cabang, 10) : undefined
    const marketingId = req.query.marketing ? parseInt(req.query.marketing, 10) : undefined
    const ktp = req.query.ktp || undefined
    const kk = req.query.kk || undefined
    const aging = req.query.aging || undefined
    const doc = req.query.doc || undefined
    const q = req.query.q || undefined
    const addr = req.query.addr || undefined
    const status = req.query.status || undefined
    const unpaid = req.query.unpaid || undefined
    const { data, total } = await fetchCustomers({ page, limit, cabangId, marketingId, ktp, kk, aging, doc, q, addr, status, unpaid })
    const stats = await fetchCustomerStats({ cabangId, marketingId })
    res.json({ data, meta: { page, limit, total, totalPages: limit > 0 ? Math.ceil(total / limit) : 1 }, stats })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/customers/export', async (req, res) => {
  try {
    const cabangId = req.query.cabang ? parseInt(req.query.cabang, 10) : undefined
    const marketingId = req.query.marketing ? parseInt(req.query.marketing, 10) : undefined
    const ktp = req.query.ktp || undefined
    const kk = req.query.kk || undefined
    const aging = req.query.aging || undefined
    const doc = req.query.doc || undefined
    const q = req.query.q || undefined
    const addr = req.query.addr || undefined
    const status = req.query.status || undefined
    const unpaid = req.query.unpaid || undefined

    // Fetch all data without pagination
    const { data } = await fetchCustomers({ page: 1, limit: 0, cabangId, marketingId, ktp, kk, aging, doc, q, addr, status, unpaid })

    // Create workbook
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Data Customer')

    // Define columns
    worksheet.columns = [
      { header: 'No', key: 'no', width: 5 },
      { header: 'Kode Customer', key: 'kode_customer', width: 15 },
      { header: 'Nama Customer', key: 'nama_customer', width: 30 },
      { header: 'No HP', key: 'no_hp', width: 15 },
      { header: 'Alamat', key: 'alamat_lengkap', width: 40 },
      { header: 'Cabang', key: 'nama_cabang', width: 20 },
      { header: 'Marketing', key: 'nama_marketing', width: 25 },
      { header: 'Status', key: 'status_user', width: 12 },
      { header: 'Alasan Blacklist', key: 'blacklist_reason', width: 25 },
      { header: 'Sisa Bayar', key: 'sisa_total', width: 15 },
      { header: 'Aging (Bulan)', key: 'aging_months', width: 12 },
      { header: 'Tanggal Register', key: 'tanggal_register', width: 18 }
    ]

    // Style header
    worksheet.getRow(1).font = { bold: true }
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    }
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }

    // Add data
    data.forEach((row, idx) => {
      const excelRow = worksheet.addRow({
        no: idx + 1,
        kode_customer: row.kode_customer,
        nama_customer: row.nama_customer,
        no_hp: row.no_hp,
        alamat_lengkap: row.alamat_lengkap || '-',
        nama_cabang: row.nama_cabang || '-',
        nama_marketing: row.nama_marketing || '-',
        status_user: row.status_user === 'blacklist' ? 'Blacklist' : 'Normal',
        blacklist_reason: row.status_user === 'blacklist' ? (row.blacklist_reason || '-') : '-',
        sisa_total: row.sisa_total,
        aging_months: row.sisa_total > 0 ? row.aging_months : '-',
        tanggal_register: row.tanggal_register ? new Date(row.tanggal_register).toLocaleDateString('id-ID') : '-'
      })

      // Format currency
      excelRow.getCell('sisa_total').numFmt = '#,##0'

      // Color code based on status
      if (row.status_user === 'blacklist') {
        excelRow.getCell('status_user').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFECACA' }
        }
      }

      // Color code based on payment status
      if (row.sisa_total > 0) {
        excelRow.getCell('sisa_total').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFED7AA' }
        }
      } else {
        excelRow.getCell('sisa_total').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD1FAE5' }
        }
      }
    })

    // Set response headers
    const filename = `Data_Customer_${new Date().toISOString().split('T')[0]}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    // Write to response
    await workbook.xlsx.write(res)
    res.end()
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

const upload = multer({ storage: multer.memoryStorage() })

router.post('/customer/:kode/upload-docs', upload.fields([{ name: 'ktp', maxCount: 1 }, { name: 'kk', maxCount: 1 }]), async (req, res) => {
  try {
    const { kode } = req.params
    const files = req.files || {}

    const baseDir = path.join(process.cwd(), 'uploads')
    const ktpDir = path.join(baseDir, 'customer_ktp')
    const kkDir = path.join(baseDir, 'customer_kk')

    // Ensure directories exist
    if (!fs.existsSync(ktpDir)) fs.mkdirSync(ktpDir, { recursive: true })
    if (!fs.existsSync(kkDir)) fs.mkdirSync(kkDir, { recursive: true })

    let fileKtpName, fileKkName
    if (files.ktp && files.ktp[0]) {
      const f = files.ktp[0]
      const ext = (f.mimetype?.split('/')?.[1] || 'jpg').toLowerCase()
      fileKtpName = `${kode}-KTP-${Date.now()}.${ext}`
      await fs.promises.writeFile(path.join(ktpDir, fileKtpName), f.buffer)
    }
    if (files.kk && files.kk[0]) {
      const f = files.kk[0]
      const ext = (f.mimetype?.split('/')?.[1] || 'jpg').toLowerCase()
      fileKkName = `${kode}-KK-${Date.now()}.${ext}`
      await fs.promises.writeFile(path.join(kkDir, fileKkName), f.buffer)
    }
    if (fileKtpName || fileKkName) {
      const fields = []
      const params = []
      if (fileKtpName) { fields.push('file_ktp = ?'); params.push(fileKtpName) }
      if (fileKkName) { fields.push('file_kk = ?'); params.push(fileKkName) }
      params.push(kode)
      await pool.query(`UPDATE customer SET ${fields.join(', ')} WHERE kode_customer = ?`, params)
    }
    res.json({ ok: true, file_ktp: fileKtpName, file_kk: fileKkName })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/customer/:kode/status', async (req, res) => {
  try {
    const { kode } = req.params
    const statusReq = String((req.body?.status || '')).toLowerCase()
    const reason = req.body?.reason || ''
    const val = statusReq === 'blacklist' ? 'blacklist' : ''
    const reasonVal = val === 'blacklist' ? reason : ''

    await pool.query(`UPDATE customer SET status_user = ?, blacklist_reason = ? WHERE kode_customer = ? OR kode_qr = ?`, [val, reasonVal, kode, kode])
    const [rows] = await pool.query(`SELECT status_user, blacklist_reason FROM customer WHERE kode_customer = ? OR kode_qr = ? LIMIT 1`, [kode, kode])
    return res.json({ status: rows?.[0]?.status_user || '', reason: rows?.[0]?.blacklist_reason || '' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/image/:type/:filename', (req, res) => {
  try {
    const { type, filename } = req.params
    const allowedTypes = ['ktp', 'kk']
    if (!allowedTypes.includes(type)) return res.status(400).json({ error: 'Invalid type' })

    const folder = type === 'ktp' ? 'customer_ktp' : 'customer_kk'
    const filePath = path.join(process.cwd(), 'uploads', folder, filename)

    if (fs.existsSync(filePath)) {
      res.sendFile(filePath)
    } else {
      res.status(404).json({ error: 'Image not found' })
    }
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router