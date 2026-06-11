import mysql from 'mysql2/promise'

async function main(){
  const start = process.argv[2] || process.env.START || '2025-11-01'
  const end = process.argv[3] || process.env.END || '2025-11-30'
  const cabang = process.argv[4] || process.env.CABANG || null
  const pool = await mysql.createPool({ host: 'localhost', user: 'root', password: '', database: 'optiklivina_dbs', dateStrings: true })
  const sql = "SELECT t.id_marketing, admin.nama_lengkap AS nama_marketing, SUM(p.jumlah_bayar) AS total_bayar_periode FROM transaksi_pembayaran p LEFT JOIN transaksi t ON t.kode_transaksi = p.kode_transaksi LEFT JOIN admin ON admin.id = t.id_marketing WHERE p.tanggal_bayar BETWEEN ? AND ?" + (cabang ? " AND t.id_cabang = ?" : "") + " GROUP BY t.id_marketing, admin.nama_lengkap ORDER BY total_bayar_periode DESC"
  const params = cabang ? [start, end, cabang] : [start, end]
  const [rows] = await pool.query(sql, params)
  const total = rows.reduce((a,r)=>a+Number(r.total_bayar_periode||0),0)
  let nama_cabang = null
  if (cabang) {
    const [cRows] = await pool.query('SELECT nama_cabang FROM cabang_toko WHERE id_cabang = ? LIMIT 1', [cabang])
    nama_cabang = cRows?.[0]?.nama_cabang || null
  }
  console.log(JSON.stringify({ start, end, cabang, nama_cabang, total, rows }, null, 2))
  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })