import mysql from 'mysql2/promise'

async function main(){
  const host = process.env.DB_HOST || 'localhost'
  const user = process.env.DB_USER || 'root'
  const password = process.env.DB_PASS || ''
  const database = process.env.DB_NAME || 'optiklivina_dbs'
  const conn = await mysql.createConnection({ host, user, password, database })
  const produkId = Number(process.env.PRODUK_ID || 2288)
  const cabangId = Number(process.env.CABANG_ID || 2)
  const kode = String(process.env.KODE || '200522000122281')
  const [r1] = await conn.query(`SELECT kode_grosir,id_cabang,tanggal_grosir,jam_log FROM grosir WHERE kode_grosir=?`, [kode])
  console.log('grosir:', r1)
  const [r2] = await conn.query(`SELECT MAX(gl.tanggal_log) AS last_log FROM grosir_log gl JOIN grosir g ON g.kode_grosir=gl.id_grosir WHERE gl.jenis_produk='frame' AND gl.id_produk=? AND g.id_cabang=?`, [produkId, cabangId])
  console.log('last_log_by_cabang:', r2)
  const [r3] = await conn.query(`SELECT MAX(gl.tanggal_log) AS last_log FROM grosir_log gl WHERE gl.id_grosir=? AND gl.id_produk=? AND gl.jenis_produk='frame'`, [kode, produkId])
  console.log('last_log_by_kode:', r3)
  await conn.end()
}

main().catch(e => { console.error(e); process.exit(1) })

