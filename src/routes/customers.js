import { Router } from 'express'
import multer from 'multer'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { pool } from '../db.js'
import { fetchCustomerProfileByTrans, fetchCustomerProfileByCode, fetchCustomerSummaryByCode, fetchCustomers } from '../services/reportsService.js'

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
    const { data, total } = await fetchCustomers({ page, limit, cabangId, marketingId, ktp, kk, aging, doc, q, addr })
    res.json({ data, meta: { page, limit, total, totalPages: limit>0 ? Math.ceil(total/limit) : 1 } })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

const upload = multer({ storage: multer.memoryStorage() })
const s3UploadClient = (() => {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'id-jkt-1-default'
  const endpoint = process.env.AWS_S3_ENDPOINT || 'https://is3.cloudhost.id'
  if (!accessKeyId || !secretAccessKey) return null
  return new S3Client({ region, endpoint, forcePathStyle: true, credentials: { accessKeyId, secretAccessKey } })
})()

router.post('/customer/:kode/upload-docs', upload.fields([{ name: 'ktp', maxCount: 1 }, { name: 'kk', maxCount: 1 }]), async (req, res) => {
  try{
    const { kode } = req.params
    const bucket = process.env.AWS_BUCKET || 'optiklivina'
    const prefix = (process.env.AWS_S3_PREFIX || 'demo').replace(/\/$/, '')
    const files = req.files || {}
    if (!s3UploadClient) return res.status(500).json({ error: 'S3 is not configured' })
    let fileKtpName, fileKkName
    if (files.ktp && files.ktp[0]){
      const f = files.ktp[0]
      const ext = (f.mimetype?.split('/')?.[1] || 'jpg').toLowerCase()
      fileKtpName = `${kode}-KTP-${Date.now()}.${ext}`
      const key = `${prefix}/uploads/customer_ktp/${fileKtpName}`
      await s3UploadClient.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: f.buffer, ContentType: f.mimetype, ACL: 'public-read' }))
    }
    if (files.kk && files.kk[0]){
      const f = files.kk[0]
      const ext = (f.mimetype?.split('/')?.[1] || 'jpg').toLowerCase()
      fileKkName = `${kode}-KK-${Date.now()}.${ext}`
      const key = `${prefix}/uploads/customer_kk/${fileKkName}`
      await s3UploadClient.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: f.buffer, ContentType: f.mimetype, ACL: 'public-read' }))
    }
    if (fileKtpName || fileKkName){
      const fields = []
      const params = []
      if (fileKtpName){ fields.push('file_ktp = ?'); params.push(fileKtpName) }
      if (fileKkName){ fields.push('file_kk = ?'); params.push(fileKkName) }
      params.push(kode)
      await pool.query(`UPDATE customer SET ${fields.join(', ')} WHERE kode_customer = ?`, params)
    }
    res.json({ ok: true, file_ktp: fileKtpName, file_kk: fileKkName })
  }catch(e){
    res.status(500).json({ error: e.message })
  }
})

router.post('/customer/:kode/status', async (req, res) => {
  try{
    const { kode } = req.params
    const statusReq = String((req.body?.status || '')).toLowerCase()
    const val = statusReq === 'blacklist' ? 'blacklist' : null
    await pool.query(`UPDATE customer SET status_user = ? WHERE kode_customer = ? OR kode_qr = ?`, [val, kode, kode])
    const [rows] = await pool.query(`SELECT status_user FROM customer WHERE kode_customer = ? OR kode_qr = ? LIMIT 1`, [kode, kode])
    return res.json({ status: rows?.[0]?.status_user || null })
  }catch(e){
    res.status(500).json({ error: e.message })
  }
})

export default router