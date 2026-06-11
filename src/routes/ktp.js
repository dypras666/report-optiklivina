import { Router } from 'express'
import multer from 'multer'
import { pool } from '../db.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

function extractKtpData(ocr){
  try{
    const result = ocr?.result || {}
    const g = (k) => (result?.[k]?.value ?? '').toString()
    return {
      nik: g('nik'),
      nama: g('nama'),
      tempatLahir: g('tempatLahir'),
      tanggalLahir: g('tanggalLahir'),
      jenisKelamin: g('jenisKelamin'),
      alamat: g('alamat'),
      rt: g('rt'),
      rw: g('rw'),
      kelurahanDesa: g('kelurahanDesa'),
      kecamatan: g('kecamatan'),
      kabupatenKota: g('kabupatenKota'),
      provinsi: g('provinsi'),
      agama: g('agama'),
      statusPerkawinan: g('statusPerkawinan'),
      pekerjaan: g('pekerjaan')
    }
  }catch{ return {} }
}

function toDbDate(input){
  try{
    const s = String(input||'').trim()
    if(!s) return null
    const m1 = s.match(/^([0-3]?\d)[\-/]([0-1]?\d)[\-/](\d{2,4})$/)
    if(m1){
      const d = m1[1].padStart(2,'0')
      const mo = m1[2].padStart(2,'0')
      const y = m1[3].length===2 ? `20${m1[3]}` : m1[3]
      return `${y}-${mo}-${d}`
    }
    const bulanMap = {
      januari: '01', feb: '02', februari: '02', maret: '03', april: '04', mei: '05', juni: '06', juli: '07', agustus: '08', september: '09', okt: '10', oktober: '10', november: '11', desember: '12'
    }
    const m2 = s.match(/^([0-3]?\d)\s+([A-Za-z\.]+)\s+(\d{2,4})$/)
    if(m2){
      const d = m2[1].padStart(2,'0')
      const key = m2[2].toLowerCase()
      const mo = bulanMap[key] || bulanMap[key.replace(/\.$/,'')] || null
      const y = m2[3].length===2 ? `20${m2[3]}` : m2[3]
      if(mo) return `${y}-${mo}-${d}`
    }
    const dt = new Date(s)
    if(!isNaN(dt.getTime())){
      const y = dt.getFullYear().toString()
      const mo = (dt.getMonth()+1).toString().padStart(2,'0')
      const d = dt.getDate().toString().padStart(2,'0')
      return `${y}-${mo}-${d}`
    }
    return null
  }catch{ return null }
}

router.post('/customer/qr', async (req, res) => {
  try{
    const kode = String(req.body?.kode_customer||'').trim()
    if(!kode) return res.status(400).json({ error: 'kode_customer required' })
    let code = ''
    for(let i=0;i<10;i++){
      const candidate = String(Math.floor(1000 + Math.random()*9000))
      const [rows] = await pool.query('SELECT COUNT(*) AS c FROM customer WHERE kode_qr = ?', [candidate])
      if(Number(rows?.[0]?.c||0) === 0){ code = candidate; break }
    }
    if(!code) return res.status(500).json({ error: 'failed to generate unique code' })
    await pool.query('UPDATE customer SET kode_qr=? WHERE kode_customer=?', [code, kode])
    const frontend = process.env.KTP_FRONTEND_BASE || process.env.FRONTEND_BASE || 'https://fe-ktp.vercel.app'
    const link = `${frontend}/?code=${encodeURIComponent(code)}`
    res.json({ ok: true, code, link })
  }catch(e){ res.status(500).json({ error: e.message }) }
})

router.post('/ktp/scan', upload.single('file'), async (req, res) => {
  try{
    const code = String(req.body?.code||'').trim()
    if(!code) return res.status(400).json({ error: 'code required' })
    const file = req.file
    if(!file) return res.status(400).json({ error: 'file required' })
    const token = process.env.AKSARAKAN_TOKEN || ''
    if(!token) return res.status(500).json({ error: 'ocr token not configured' })

    const form = new FormData()
    const blob = new Blob([file.buffer], { type: file.mimetype || 'image/jpeg' })
    form.append('file', blob, file.originalname || 'ktp.jpg')
    const uri = 'https://api.aksarakan.com/document/ktp'
    const ocrRes = await fetch(uri, { method: 'PUT', headers: { 'Authentication': `Bearer ${token}` }, body: form })
    const ocrJson = await ocrRes.json()
    if(!(ocrRes.status===200 || ocrRes.status===201)){
      return res.status(400).json({ error: ocrJson?.message || 'OCR failed', raw: ocrJson })
    }
    const data = extractKtpData(ocrJson)
    const [rows] = await pool.query('SELECT id_customer, kode_customer FROM customer WHERE kode_qr=? OR kode_customer=? LIMIT 1', [code, code])
    const cust = rows?.[0] || null
    if(!cust) return res.status(404).json({ error: 'customer not found' })
    res.json({ ok: true, parsed: data, kode_customer: cust.kode_customer })
  }catch(e){ res.status(500).json({ error: e.message }) }
})

router.post('/ktp/confirm', async (req, res) => {
  try{
    const code = String(req.body?.code||'').trim()
    const kodeCustomerBody = String(req.body?.kode_customer||'').trim()
    if(!code && !kodeCustomerBody) return res.status(400).json({ error: 'code or kode_customer required' })
    const [rows] = await pool.query('SELECT kode_customer FROM customer WHERE kode_qr=? OR kode_customer=? LIMIT 1', [code||null, kodeCustomerBody||null])
    const cust = rows?.[0] || null
    if(!cust) return res.status(404).json({ error: 'customer not found' })
    const body = req.body || {}
    const tanggalDb = toDbDate(body.tanggalLahir)
    const updates = {
      no_ktp: body.nik || null,
      nama_customer: body.nama || null,
      tempat_lahir: body.tempatLahir || null,
      tanggal_lahir: tanggalDb,
      jk: body.jenisKelamin || null,
      alamat_lengkap: body.alamat || null,
      kabupaten: body.kabupatenKota || null,
      kecamatan: body.kecamatan || null,
      desa: body.kelurahanDesa || null,
      status_user: 'active',
      kode_qr: null,
    }
    const fields = Object.keys(updates)
    const vals = Object.values(updates)
    vals.push(cust.kode_customer)
    await pool.query(`UPDATE customer SET ${fields.map(k=>`${k}=?`).join(', ')} WHERE kode_customer=?`, vals)
    res.json({ ok: true })
  }catch(e){ res.status(500).json({ error: e.message }) }
})

export default router
