import { pool } from '../db.js'
import crypto from 'crypto'

class AuthController {
  /**
   * Authenticate user (supports level = 10 collectors and other levels)
   * POST /api/auth/login
   */
  static async login(req, res) {
    try {
      const { username, password } = req.body

      if (!username || !password) {
        return res.status(400).json({
          error: 'Username and password are required'
        })
      }

      // Query admin table for user
      const query = `
        SELECT 
          a.id,
          a.username,
          a.password,
          a.nama_lengkap,
          a.level,
          a.id_cabang,
          a.status_user,
          ct.nama_cabang,
          ct.alamat_cabang
        FROM admin a
        LEFT JOIN cabang_toko ct ON ct.id_cabang = a.id_cabang
        WHERE a.username = ? AND a.status_user = 1
        LIMIT 1
      `

      const [rows] = await pool.execute(query, [username])

      if (rows.length === 0) {
        return res.status(401).json({
          error: 'Invalid credentials'
        })
      }

      const user = rows[0]

      // Verify password (MD5 or SHA1)
      const md5Hash = crypto.createHash('md5').update(password).digest('hex')
      const sha1Hash = crypto.createHash('sha1').update(password).digest('hex')

      const isValid =
        md5Hash === user.password.toLowerCase() ||
        sha1Hash === user.password.toLowerCase() ||
        password === user.password

      if (!isValid) {
        return res.status(401).json({
          error: 'Invalid credentials'
        })
      }

      // Generate token (using the existing token generation from app.js)
      const secret = process.env.AUTH_SECRET || ''
      if (!secret) {
        return res.status(500).json({ error: 'Auth not configured' })
      }

      const iat = Date.now()
      const exp = iat + (12 * 60 * 60 * 1000) // 12 hours
      const payload = { sub: username, level: user.level, id: user.id, iat, exp }

      const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
      const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url')
      const token = `${data}.${sig}`

      // Return user info and token
      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          nama_lengkap: user.nama_lengkap,
          level: user.level,
          id_cabang: user.id_cabang,
          cabang: user.id_cabang ? {
            id: user.id_cabang,
            nama: user.nama_cabang,
            alamat: user.alamat_cabang
          } : null
        }
      })
    } catch (error) {
      console.error('[AuthController] Login error:', error)
      res.status(500).json({
        error: 'Login failed',
        details: error.message
      })
    }
  }

  /**
   * Verify token and get user info
   * GET /api/auth/me
   */
  static async me(req, res) {
    try {
      const auth = req.headers['authorization'] || ''
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''

      if (!token) {
        return res.status(401).json({ error: 'No token provided' })
      }

      const secret = process.env.AUTH_SECRET || ''
      const parts = token.split('.')

      if (parts.length !== 2) {
        return res.status(401).json({ error: 'Invalid token' })
      }

      const [data, sig] = parts
      const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url')

      if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
        return res.status(401).json({ error: 'Invalid token' })
      }

      const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'))

      if (payload.exp && Date.now() > payload.exp) {
        return res.status(401).json({ error: 'Token expired' })
      }

      // Get fresh user data
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
        WHERE a.id = ? AND a.status_user = 1
        LIMIT 1
      `

      const [rows] = await pool.execute(query, [payload.id])

      if (rows.length === 0) {
        return res.status(401).json({ error: 'User not found or inactive' })
      }

      const user = rows[0]

      res.json({
        user: {
          id: user.id,
          username: user.username,
          nama_lengkap: user.nama_lengkap,
          level: user.level,
          id_cabang: user.id_cabang,
          cabang: user.id_cabang ? {
            id: user.id_cabang,
            nama: user.nama_cabang,
            alamat: user.alamat_cabang
          } : null
        }
      })
    } catch (error) {
      console.error('[AuthController] Me error:', error)
      res.status(500).json({
        error: 'Failed to get user info',
        details: error.message
      })
    }
  }
}

export default AuthController
