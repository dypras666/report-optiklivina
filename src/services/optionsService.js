import { pool } from '../db.js'

export async function listMarketing({ q = '', limit = 500, cabangId = '' }) {
  const params = []
  let where = 'WHERE 1=1'
  if (q) { where += ' AND admin.nama_lengkap LIKE ?'; params.push(`%${q}%`) }
  if (cabangId) { where += ' AND admin.id_cabang = ?'; params.push(cabangId) }
  where += " AND admin.level = '4'"
  const [rows] = await pool.query(
    `SELECT id AS value, CONCAT(nama_lengkap, CASE WHEN status_user = 1 THEN '' ELSE ' (Nonaktif)' END) AS label, status_user FROM admin ${where} ORDER BY status_user DESC, nama_lengkap ASC LIMIT ?`,
    [...params, Number(limit)]
  )
  return rows
}

export async function listCabang({ q = '', limit = 50 }) {
  const params = []
  let where = 'WHERE 1=1'
  if (q) { where += ' AND cabang_toko.nama_cabang LIKE ?'; params.push(`%${q}%`) }
  const [rows] = await pool.query(
    `SELECT id_cabang AS value, nama_cabang AS label FROM cabang_toko ${where} ORDER BY nama_cabang LIMIT ?`,
    [...params, Number(limit)]
  )
  return rows
}