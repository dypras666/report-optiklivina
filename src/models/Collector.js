import { pool } from '../db.js'
import crypto from 'crypto'

class Collector {
    /**
     * Create a new collector account with level = 10
     * @param {Object} data - Collector data
     * @param {string} data.username - Username for login
     * @param {string} data.password - Plain text password (will be hashed)
     * @param {string} data.nama_lengkap - Full name
     * @param {number} data.id_cabang - Branch ID (optional)
     * @returns {Promise<number>} - Inserted ID
     */
    static async createCollector(data) {
        const { username, password, nama_lengkap, id_cabang } = data

        // Hash password using MD5 (matching existing system)
        const hashedPassword = crypto.createHash('md5').update(password).digest('hex')

        const query = `
      INSERT INTO admin (username, password, nama_lengkap, level, id_cabang, status_user)
      VALUES (?, ?, ?, 10, ?, 1)
    `

        const [result] = await pool.execute(query, [
            username,
            hashedPassword,
            nama_lengkap,
            id_cabang || null
        ])

        return result.insertId
    }

    /**
     * Get all collectors (level = 10) with pagination
     * @param {Object} filters - Filter options
     * @param {number} filters.page - Page number
     * @param {number} filters.limit - Items per page
     * @param {string} filters.q - Search query
     * @returns {Promise<Object>} - Collectors data and metadata
     */
    static async getCollectors(filters = {}) {
        const { page = 1, limit = 20, q = '' } = filters
        const parsedLimit = parseInt(limit, 10)
        const parsedPage = parseInt(page, 10)
        const offset = (parsedPage - 1) * parsedLimit

        let whereClause = 'WHERE a.level = 10'
        const params = []

        if (q) {
            whereClause += ' AND (a.username LIKE ? OR a.nama_lengkap LIKE ?)'
            params.push(`%${q}%`, `%${q}%`)
        }

        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM admin a ${whereClause}`
        const [countResult] = await pool.execute(countQuery, params)
        const total = countResult[0].total

        // Get paginated data
        const dataQuery = `
      SELECT 
        a.id,
        a.username,
        a.nama_lengkap,
        a.level,
        a.id_cabang,
        a.status_user,
        ct.nama_cabang,
        ct.alamat_cabang
      FROM admin a
      LEFT JOIN cabang_toko ct ON ct.id_cabang = a.id_cabang
      ${whereClause}
      ORDER BY a.id DESC
      LIMIT ? OFFSET ?
    `

        const [rows] = await pool.query(dataQuery, [...params, parsedLimit, offset])

        return {
            data: rows,
            meta: {
                page: parsedPage,
                limit: parsedLimit,
                total,
                totalPages: Math.ceil(total / parsedLimit)
            }
        }
    }

    /**
     * Get collector by ID
     * @param {number} id - Collector ID
     * @returns {Promise<Object|null>} - Collector data or null
     */
    static async getCollectorById(id) {
        const query = `
      SELECT 
        a.id,
        a.username,
        a.nama_lengkap,
        a.level,
        a.id_cabang,
        a.status_user,
        ct.nama_cabang,
        ct.alamat_cabang
      FROM admin a
      LEFT JOIN cabang_toko ct ON ct.id_cabang = a.id_cabang
      WHERE a.id = ? AND a.level = 10
      LIMIT 1
    `

        const [rows] = await pool.execute(query, [id])
        return rows.length > 0 ? rows[0] : null
    }

    /**
     * Update collector information
     * @param {number} id - Collector ID
     * @param {Object} data - Update data
     * @returns {Promise<boolean>} - Success status
     */
    static async updateCollector(id, data) {
        const { nama_lengkap, id_cabang, password } = data

        const updates = []
        const params = []

        if (nama_lengkap !== undefined) {
            updates.push('nama_lengkap = ?')
            params.push(nama_lengkap)
        }

        if (id_cabang !== undefined) {
            updates.push('id_cabang = ?')
            params.push(id_cabang)
        }

        if (password) {
            const hashedPassword = crypto.createHash('md5').update(password).digest('hex')
            updates.push('password = ?')
            params.push(hashedPassword)
        }

        if (updates.length === 0) {
            return false
        }

        params.push(id)

        const query = `
      UPDATE admin 
      SET ${updates.join(', ')}
      WHERE id = ? AND level = 10
    `

        const [result] = await pool.execute(query, params)
        return result.affectedRows > 0
    }

    /**
     * Deactivate collector account
     * @param {number} id - Collector ID
     * @returns {Promise<boolean>} - Success status
     */
    static async deactivateCollector(id) {
        const query = `
      UPDATE admin 
      SET status_user = 0
      WHERE id = ? AND level = 10
    `

        const [result] = await pool.execute(query, [id])
        return result.affectedRows > 0
    }

    /**
     * Activate collector account
     * @param {number} id - Collector ID
     * @returns {Promise<boolean>} - Success status
     */
    static async activateCollector(id) {
        const query = `
      UPDATE admin 
      SET status_user = 1
      WHERE id = ? AND level = 10
    `

        const [result] = await pool.execute(query, [id])
        return result.affectedRows > 0
    }

    /**
     * Check if username already exists
     * @param {string} username - Username to check
     * @returns {Promise<boolean>} - True if exists
     */
    static async usernameExists(username) {
        const query = 'SELECT COUNT(*) as count FROM admin WHERE username = ?'
        const [rows] = await pool.execute(query, [username])
        return rows[0].count > 0
    }
}

export default Collector
