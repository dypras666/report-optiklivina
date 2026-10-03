import express from 'express'
import { pool } from '../db.js'

const router = express.Router()

// Get all branches (Cabang)
router.get('/cabang', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id_cabang, nama_cabang, alamat_cabang, status_show_modal, status_show_diskon, status_show_harga_cabang 
      FROM cabang_toko
      ORDER BY nama_cabang ASC
    `)
    res.json({ success: true, data: rows })
  } catch (error) {
    console.error('[MANAGEMENT] getCabangList error:', error)
    res.status(500).json({ success: false, error: 'Gagal mengambil data cabang' })
  }
})

// Toggle modal visibility for a branch
router.post('/cabang/toggle-modal', async (req, res) => {
  try {
    const { id_cabang, status } = req.body
    if (id_cabang === undefined || status === undefined) {
      return res.status(400).json({ success: false, error: 'id_cabang dan status diperlukan' })
    }
    const [result] = await pool.query(
      'UPDATE cabang_toko SET status_show_modal = ? WHERE id_cabang = ?',
      [status, id_cabang]
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Data cabang tidak ditemukan' })
    }
    res.json({ success: true, message: 'Status modal cabang berhasil diubah' })
  } catch (error) {
    console.error('[MANAGEMENT] toggleCabangModal error:', error)
    res.status(500).json({ success: false, error: 'Gagal mengubah status modal cabang' })
  }
})

// Toggle diskon visibility for a branch
router.post('/cabang/toggle-diskon', async (req, res) => {
  try {
    const { id_cabang, status } = req.body
    if (id_cabang === undefined || status === undefined) {
      return res.status(400).json({ success: false, error: 'id_cabang dan status diperlukan' })
    }
    const [result] = await pool.query(
      'UPDATE cabang_toko SET status_show_diskon = ? WHERE id_cabang = ?',
      [status, id_cabang]
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Data cabang tidak ditemukan' })
    }
    res.json({ success: true, message: 'Status diskon cabang berhasil diubah' })
  } catch (error) {
    console.error('[MANAGEMENT] toggleCabangDiskon error:', error)
    res.status(500).json({ success: false, error: 'Gagal mengubah status diskon cabang' })
  }
})

// Toggle harga cabang visibility for a branch
router.post('/cabang/toggle-harga-cabang', async (req, res) => {
  try {
    const { id_cabang, status } = req.body
    if (id_cabang === undefined || status === undefined) {
      return res.status(400).json({ success: false, error: 'id_cabang dan status diperlukan' })
    }
    const [result] = await pool.query(
      'UPDATE cabang_toko SET status_show_harga_cabang = ? WHERE id_cabang = ?',
      [status, id_cabang]
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Data cabang tidak ditemukan' })
    }
    res.json({ success: true, message: 'Status harga cabang berhasil diubah' })
  } catch (error) {
    console.error('[MANAGEMENT] toggleCabangHargaCabang error:', error)
    res.status(500).json({ success: false, error: 'Gagal mengubah status harga cabang' })
  }
})

// Toggle all branches for a specific field ('modal', 'diskon', 'hargaCabang')
router.post('/cabang/toggle-all', async (req, res) => {
  try {
    const { field, status } = req.body
    if (!field || status === undefined) {
      return res.status(400).json({ success: false, error: 'field dan status diperlukan' })
    }
    const columnMap = {
      modal: 'status_show_modal',
      diskon: 'status_show_diskon',
      hargaCabang: 'status_show_harga_cabang'
    }
    const col = columnMap[field]
    if (!col) {
      return res.status(400).json({ success: false, error: 'field tidak valid' })
    }
    await pool.query(`UPDATE cabang_toko SET ${col} = ?`, [status])
    res.json({ success: true, message: `Status ${field} semua cabang berhasil diubah` })
  } catch (error) {
    console.error('[MANAGEMENT] toggleCabangAll error:', error)
    res.status(500).json({ success: false, error: 'Gagal mengubah status semua cabang' })
  }
})

// Get all groups/roles (Posisi)
router.get('/groups', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, name, description, status_show_modal, status_show_diskon, status_show_harga_cabang
      FROM groups
      ORDER BY id ASC
    `)
    res.json({ success: true, data: rows })
  } catch (error) {
    console.error('[MANAGEMENT] getGroupList error:', error)
    res.status(500).json({ success: false, error: 'Gagal mengambil data posisi' })
  }
})

// Toggle modal visibility for a group/role
router.post('/groups/toggle-modal', async (req, res) => {
  try {
    const { id, status } = req.body
    if (id === undefined || status === undefined) {
      return res.status(400).json({ success: false, error: 'id dan status diperlukan' })
    }
    const [result] = await pool.query(
      'UPDATE groups SET status_show_modal = ? WHERE id = ?',
      [status, id]
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Data posisi tidak ditemukan' })
    }
    res.json({ success: true, message: 'Status modal posisi berhasil diubah' })
  } catch (error) {
    console.error('[MANAGEMENT] toggleGroupModal error:', error)
    res.status(500).json({ success: false, error: 'Gagal mengubah status modal posisi' })
  }
})

// Toggle diskon visibility for a group/role
router.post('/groups/toggle-diskon', async (req, res) => {
  try {
    const { id, status } = req.body
    if (id === undefined || status === undefined) {
      return res.status(400).json({ success: false, error: 'id dan status diperlukan' })
    }
    const [result] = await pool.query(
      'UPDATE groups SET status_show_diskon = ? WHERE id = ?',
      [status, id]
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Data posisi tidak ditemukan' })
    }
    res.json({ success: true, message: 'Status diskon posisi berhasil diubah' })
  } catch (error) {
    console.error('[MANAGEMENT] toggleGroupDiskon error:', error)
    res.status(500).json({ success: false, error: 'Gagal mengubah status diskon posisi' })
  }
})

// Toggle harga cabang visibility for a group/role
router.post('/groups/toggle-harga-cabang', async (req, res) => {
  try {
    const { id, status } = req.body
    if (id === undefined || status === undefined) {
      return res.status(400).json({ success: false, error: 'id dan status diperlukan' })
    }
    const [result] = await pool.query(
      'UPDATE groups SET status_show_harga_cabang = ? WHERE id = ?',
      [status, id]
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Data posisi tidak ditemukan' })
    }
    res.json({ success: true, message: 'Status harga cabang berhasil diubah' })
  } catch (error) {
    console.error('[MANAGEMENT] toggleGroupHargaCabang error:', error)
    res.status(500).json({ success: false, error: 'Gagal mengubah status harga cabang' })
  }
})

// Toggle all groups/roles for a specific field ('modal', 'diskon', 'hargaCabang')
router.post('/groups/toggle-all', async (req, res) => {
  try {
    const { field, status } = req.body
    if (!field || status === undefined) {
      return res.status(400).json({ success: false, error: 'field dan status diperlukan' })
    }
    const columnMap = {
      modal: 'status_show_modal',
      diskon: 'status_show_diskon',
      hargaCabang: 'status_show_harga_cabang'
    }
    const col = columnMap[field]
    if (!col) {
      return res.status(400).json({ success: false, error: 'field tidak valid' })
    }
    await pool.query(`UPDATE groups SET ${col} = ?`, [status])
    res.json({ success: true, message: `Status ${field} semua posisi berhasil diubah` })
  } catch (error) {
    console.error('[MANAGEMENT] toggleGroupAll error:', error)
    res.status(500).json({ success: false, error: 'Gagal mengubah status semua posisi' })
  }
})

// Get all marketing users (Akun Marketing)
router.get('/marketing-users', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT a.id, a.username, a.nama_lengkap, a.level, a.id_cabang, ct.nama_cabang,
             COALESCE(a.status_show_modal, g.status_show_modal, 0) AS status_show_modal,
             COALESCE(a.status_show_diskon, g.status_show_diskon, 1) AS status_show_diskon,
             COALESCE(a.status_show_harga_cabang, g.status_show_harga_cabang, 0) AS status_show_harga_cabang
      FROM admin a
      LEFT JOIN cabang_toko ct ON ct.id_cabang = a.id_cabang
      LEFT JOIN groups g ON g.id = a.level
      WHERE a.level = 4 AND a.status_user = 1
      ORDER BY ct.nama_cabang ASC, a.nama_lengkap ASC
    `)
    res.json({ success: true, data: rows })
  } catch (error) {
    console.error('[MANAGEMENT] getMarketingUsers error:', error)
    res.status(500).json({ success: false, error: 'Gagal mengambil data akun marketing' })
  }
})

// Toggle modal visibility for a marketing user
router.post('/marketing-users/toggle-modal', async (req, res) => {
  try {
    const { id, status } = req.body
    if (id === undefined || status === undefined) {
      return res.status(400).json({ success: false, error: 'id dan status diperlukan' })
    }
    const [result] = await pool.query(
      'UPDATE admin SET status_show_modal = ? WHERE id = ? AND level = 4',
      [status, id]
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Akun marketing tidak ditemukan' })
    }
    res.json({ success: true, message: 'Status modal akun marketing berhasil diubah' })
  } catch (error) {
    console.error('[MANAGEMENT] toggleMarketingUserModal error:', error)
    res.status(500).json({ success: false, error: 'Gagal mengubah status modal akun marketing' })
  }
})

// Toggle diskon visibility for a marketing user
router.post('/marketing-users/toggle-diskon', async (req, res) => {
  try {
    const { id, status } = req.body
    if (id === undefined || status === undefined) {
      return res.status(400).json({ success: false, error: 'id dan status diperlukan' })
    }
    const [result] = await pool.query(
      'UPDATE admin SET status_show_diskon = ? WHERE id = ? AND level = 4',
      [status, id]
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Akun marketing tidak ditemukan' })
    }
    res.json({ success: true, message: 'Status diskon akun marketing berhasil diubah' })
  } catch (error) {
    console.error('[MANAGEMENT] toggleMarketingUserDiskon error:', error)
    res.status(500).json({ success: false, error: 'Gagal mengubah status diskon akun marketing' })
  }
})

// Toggle harga cabang visibility for a marketing user
router.post('/marketing-users/toggle-harga-cabang', async (req, res) => {
  try {
    const { id, status } = req.body
    if (id === undefined || status === undefined) {
      return res.status(400).json({ success: false, error: 'id dan status diperlukan' })
    }
    const [result] = await pool.query(
      'UPDATE admin SET status_show_harga_cabang = ? WHERE id = ? AND level = 4',
      [status, id]
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Akun marketing tidak ditemukan' })
    }
    res.json({ success: true, message: 'Status harga cabang akun marketing berhasil diubah' })
  } catch (error) {
    console.error('[MANAGEMENT] toggleMarketingUserHargaCabang error:', error)
    res.status(500).json({ success: false, error: 'Gagal mengubah status harga cabang akun marketing' })
  }
})

// Toggle all marketing users for a specific field ('modal', 'diskon', 'hargaCabang')
router.post('/marketing-users/toggle-all', async (req, res) => {
  try {
    const { field, status } = req.body
    if (!field || status === undefined) {
      return res.status(400).json({ success: false, error: 'field dan status diperlukan' })
    }
    const columnMap = {
      modal: 'status_show_modal',
      diskon: 'status_show_diskon',
      hargaCabang: 'status_show_harga_cabang'
    }
    const col = columnMap[field]
    if (!col) {
      return res.status(400).json({ success: false, error: 'field tidak valid' })
    }
    await pool.query(`UPDATE admin SET ${col} = ? WHERE level = 4`, [status])
    res.json({ success: true, message: `Status ${field} semua akun marketing berhasil diubah` })
  } catch (error) {
    console.error('[MANAGEMENT] toggleMarketingUserAll error:', error)
    res.status(500).json({ success: false, error: 'Gagal mengubah status semua akun marketing' })
  }
})

// Get users by group/role ID (Akun Pegawai / Cabang per Role)
router.get('/groups/:id/users', async (req, res) => {
  try {
    const { id } = req.params
    const [rows] = await pool.query(`
      SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.id_cabang, ct.nama_cabang,
             u.status_show_modal, u.status_show_diskon, u.status_show_harga_cabang,
             g.status_show_modal AS role_modal,
             g.status_show_diskon AS role_diskon,
             g.status_show_harga_cabang AS role_harga_cabang,
             COALESCE(u.status_show_modal, g.status_show_modal, 0) AS effective_modal,
             COALESCE(u.status_show_diskon, g.status_show_diskon, 1) AS effective_diskon,
             COALESCE(u.status_show_harga_cabang, g.status_show_harga_cabang, 0) AS effective_harga_cabang
      FROM users u
      JOIN users_groups ug ON ug.user_id = u.id
      JOIN groups g ON g.id = ug.group_id
      LEFT JOIN cabang_toko ct ON ct.id_cabang = u.id_cabang
      WHERE ug.group_id = ? AND u.active = 1
      ORDER BY ct.nama_cabang ASC, u.first_name ASC
    `, [id])
    res.json({ success: true, data: rows })
  } catch (error) {
    console.error('[MANAGEMENT] getGroupUsers error:', error)
    res.status(500).json({ success: false, error: 'Gagal mengambil data akun user' })
  }
})

// Toggle modal visibility for a regular user
router.post('/users/toggle-modal', async (req, res) => {
  try {
    const { id, status } = req.body
    if (id === undefined || status === undefined) {
      return res.status(400).json({ success: false, error: 'id dan status diperlukan' })
    }
    const [result] = await pool.query('UPDATE users SET status_show_modal = ? WHERE id = ?', [status, id])
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Akun user tidak ditemukan' })
    }
    res.json({ success: true, message: 'Status modal akun user berhasil diubah' })
  } catch (error) {
    console.error('[MANAGEMENT] toggleUserModal error:', error)
    res.status(500).json({ success: false, error: 'Gagal mengubah status modal akun' })
  }
})

// Toggle diskon visibility for a regular user
router.post('/users/toggle-diskon', async (req, res) => {
  try {
    const { id, status } = req.body
    if (id === undefined || status === undefined) {
      return res.status(400).json({ success: false, error: 'id dan status diperlukan' })
    }
    const [result] = await pool.query('UPDATE users SET status_show_diskon = ? WHERE id = ?', [status, id])
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Akun user tidak ditemukan' })
    }
    res.json({ success: true, message: 'Status diskon akun user berhasil diubah' })
  } catch (error) {
    console.error('[MANAGEMENT] toggleUserDiskon error:', error)
    res.status(500).json({ success: false, error: 'Gagal mengubah status diskon akun' })
  }
})

// Toggle harga cabang visibility for a regular user
router.post('/users/toggle-harga-cabang', async (req, res) => {
  try {
    const { id, status } = req.body
    if (id === undefined || status === undefined) {
      return res.status(400).json({ success: false, error: 'id dan status diperlukan' })
    }
    const [result] = await pool.query('UPDATE users SET status_show_harga_cabang = ? WHERE id = ?', [status, id])
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Akun user tidak ditemukan' })
    }
    res.json({ success: true, message: 'Status harga cabang akun user berhasil diubah' })
  } catch (error) {
    console.error('[MANAGEMENT] toggleUserHargaCabang error:', error)
    res.status(500).json({ success: false, error: 'Gagal mengubah status harga cabang akun' })
  }
})

// Toggle all users in a group/role
router.post('/users/toggle-all', async (req, res) => {
  try {
    const { group_id, field, status } = req.body
    if (!group_id || !field || status === undefined) {
      return res.status(400).json({ success: false, error: 'group_id, field dan status diperlukan' })
    }
    const columnMap = {
      modal: 'status_show_modal',
      diskon: 'status_show_diskon',
      hargaCabang: 'status_show_harga_cabang'
    }
    const col = columnMap[field]
    if (!col) return res.status(400).json({ success: false, error: 'field tidak valid' })
    await pool.query(`
      UPDATE users u
      JOIN users_groups ug ON ug.user_id = u.id
      SET u.${col} = ?
      WHERE ug.group_id = ?
    `, [status, group_id])
    res.json({ success: true, message: `Status ${field} semua akun berhasil diubah` })
  } catch (error) {
    console.error('[MANAGEMENT] toggleUsersAll error:', error)
    res.status(500).json({ success: false, error: 'Gagal mengubah status semua akun' })
  }
})

export default router
