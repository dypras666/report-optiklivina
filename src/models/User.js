const db = require('../config/database');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

class User {
    // Get user by email and type (toko or marketing_kolektor)
    static async getUserByEmail(email, tipeUser) {
        let query = '';
        try {
            console.log(`[DB] Searching user by email: ${email}, type: ${tipeUser}`);

            let params = [email];

            if (tipeUser === 'toko') {
                query = `
          SELECT u.id, u.first_name AS name, u.email, u.password, 
                 u.id_cabang AS branch_id, ct.nama_cabang AS branch_name,
                 ct.alamat_cabang AS branch_address
          FROM users u
          LEFT JOIN cabang_toko ct ON ct.id_cabang = u.id_cabang
          WHERE u.email = ? AND u.active = 1
        `;
            } else if (tipeUser === 'marketing_kolektor') {
                query = `
          SELECT a.id, a.nama_lengkap AS name, a.username AS email, a.password,
                 a.level, a.id_cabang AS branch_id, ct.nama_cabang AS branch_name,
                 ct.alamat_cabang AS branch_address
          FROM admin a
          LEFT JOIN cabang_toko ct ON ct.id_cabang = a.id_cabang
          WHERE a.username = ? AND a.status_user = 1
        `;
            }

            const [rows] = await db.execute(query, params);

            if (rows.length === 0) {
                console.log(`[DB] User not found: ${email} (${tipeUser})`);
                return null;
            }

            const user = rows[0];
            console.log(`[DB] User found: ID ${user.id}, Email: ${user.email}, Branch: ${user.branch_name || 'N/A'}`);

            // Format cabang info
            const cabang = user.branch_id ? {
                id: user.branch_id,
                nama: user.branch_name,
                alamat: user.branch_address
            } : null;

            return {
                id: user.id,
                email: user.email,
                username: user.username,
                password: user.password,
                level: user.level,
                active: user.active,
                cabang: cabang
            };
        } catch (error) {
            console.error(`[DB] Error searching user ${email} (${tipeUser}):`, {
                message: error.message,
                code: error.code,
                sqlState: error.sqlState,
                query: query.replace(/\s+/g, ' ').trim()
            });

            // Provide more specific error messages
            if (error.code === 'ER_BAD_FIELD_ERROR') {
                throw new Error(`Database schema error: ${error.message}. Please check table structure.`);
            } else if (error.code === 'ER_NO_SUCH_TABLE') {
                throw new Error(`Database table not found: ${error.message}`);
            } else {
                throw error;
            }
        }
    }

    // Verify password based on user type
    static async verifyPasswordUser(tipeUser, passwordPost, passwordUser) {
        try {
            console.log(`[AUTH] Verifying password for type: ${tipeUser}`);

            if (tipeUser === 'toko') {
                // Handle CodeIgniter 3 bcrypt format ($2y$) by converting to Node.js compatible format ($2b$)
                let hashToVerify = passwordUser;
                if (passwordUser.startsWith('$2y$')) {
                    hashToVerify = passwordUser.replace(/^\$2y\$/, '$2b$');
                    console.log(`[AUTH] Converting CodeIgniter 3 hash format from $2y$ to $2b$`);
                }
                const isValid = await bcrypt.compare(passwordPost, hashToVerify);
                console.log(`[AUTH] Bcrypt verification result: ${isValid}`);
                return isValid;
            } else if (tipeUser === 'marketing_kolektor') {
                const posted = (passwordPost || '').trim();
                const stored = (passwordUser || '').trim();
                const md5Hash = crypto.createHash('md5').update(posted).digest('hex');
                const sha1Hash = crypto.createHash('sha1').update(posted).digest('hex');
                const isValid = (md5Hash === stored.toLowerCase()) || (sha1Hash === stored.toLowerCase()) || (posted === stored);
                console.log(`[AUTH] MD5/SHA1/plain verification result: ${isValid}`);
                return isValid;
            }

            console.log(`[AUTH] Unknown user type: ${tipeUser}`);
            return false;
        } catch (error) {
            console.error(`[AUTH] Password verification error for type ${tipeUser}:`, error.message);
            throw error;
        }
    }

    // Get user login with encrypted password
    static async getUserLogin(email, passwordEncrypt) {
        try {
            const userToko = await this.getUserByEmail(email, 'toko');
            const userMarketing = await this.getUserByEmail(email, 'marketing_kolektor');

            let isPasswordMatch = false;

            if (userToko) {
                isPasswordMatch = (passwordEncrypt === userToko.password);
            } else if (userMarketing) {
                isPasswordMatch = (passwordEncrypt === userMarketing.password);
            }

            return isPasswordMatch;
        } catch (error) {
            throw error;
        }
    }

    // Get user by email and password for authentication
    static async authenticateUser(email, password) {
        try {
            // Try toko user first
            let user = await this.getUserByEmail(email, 'toko');
            let userType = 'toko';

            // If not found, try marketing user
            if (!user) {
                user = await this.getUserByEmail(email, 'marketing_kolektor');
                userType = 'marketing_kolektor';
            }

            if (!user) {
                return null;
            }

            const isPasswordValid = await this.verifyPasswordUser(userType, password, user.password);

            if (!isPasswordValid) {
                return null;
            }

            // Remove password from response and add user type
            delete user.password;
            user.user_type = userType;
            return user;
        } catch (error) {
            throw error;
        }
    }

    // Get user by ID
    static async getUserById(id) {
        try {
            const [rows] = await db.execute(`
        SELECT id, email, first_name AS name, id_cabang AS branch_id, created_at 
        FROM users 
        WHERE id = ? AND active = 1
      `, [id]);

            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            throw error;
        }
    }

    // Create new user
    static async createUser(userData) {
        try {
            const { email, password, firstName, lastName, idCabang, userType = 'toko' } = userData;
            const hashedPassword = await bcrypt.hash(password, 10);

            const [result] = await db.execute(`
        INSERT INTO users (email, password, first_name, last_name, id_cabang, active, created_at) 
        VALUES (?, ?, ?, ?, ?, 1, NOW())
      `, [email, hashedPassword, firstName, lastName, idCabang]);

            return result.insertId;
        } catch (error) {
            throw error;
        }
    }
}

module.exports = User;
