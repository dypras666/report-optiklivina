import { pool } from '../db.js'

export async function getActivePembukuan(pembukuanId){
  if(Number.isInteger(pembukuanId)){
    const [rows] = await pool.query(`
      SELECT id_toko_tutup, tanggal_buka_buku, tanggal_tutup_buku
      FROM toko_tutup_buku WHERE id_toko_tutup = ? LIMIT 1
    `, [pembukuanId])
    return rows[0] || null
  }
  const [rows] = await pool.query(`
    SELECT id_toko_tutup, tanggal_buka_buku, tanggal_tutup_buku
    FROM toko_tutup_buku ORDER BY id_toko_tutup DESC LIMIT 1
  `)
  return rows[0] || null
}

export async function listPembukuan(){
  const [rows] = await pool.query(`
    SELECT id_toko_tutup, tanggal_buka_buku, tanggal_tutup_buku
    FROM toko_tutup_buku ORDER BY id_toko_tutup DESC LIMIT 50
  `)
  return rows
}

export async function getPreviousPembukuan(pembukuanId){
  const id = Number(pembukuanId)
  if(Number.isInteger(id)){
    const [rows] = await pool.query(`
      SELECT id_toko_tutup, tanggal_buka_buku, tanggal_tutup_buku
      FROM toko_tutup_buku WHERE id_toko_tutup < ? ORDER BY id_toko_tutup DESC LIMIT 1
    `, [id])
    return rows[0] || null
  }
  const [rows] = await pool.query(`
    SELECT id_toko_tutup, tanggal_buka_buku, tanggal_tutup_buku
    FROM toko_tutup_buku ORDER BY id_toko_tutup DESC LIMIT 2
  `)
  return rows?.[1] || null
}