import { pool } from '../db.js'
import { getActivePembukuan } from './pembukuanService.js'

export async function fetchApprovals({ cabangId, marketingId, pembukuanId, limit, offset, search, orderCol = 'tanggal_input_log', orderDir = 'DESC' }) {
    let dateLow = null
    let dateHigh = null
    if (pembukuanId) {
        const active = await getActivePembukuan(pembukuanId)
        if (active) {
            dateLow = active.tanggal_buka_buku + ' 00:00:00'
            dateHigh = active.tanggal_tutup_buku + ' 23:59:59'
        }
    }

    const whereBase = ['c.sponsor_approval IN (1, 2, 3)']
    const paramsBase = []

    if (cabangId) {
        whereBase.push('c.cabang = ?')
        paramsBase.push(cabangId)
    }
    if (marketingId) {
        whereBase.push('c.id_marketing = ?')
        paramsBase.push(marketingId)
    }
    if (dateLow && dateHigh) {
        whereBase.push('c.sponsor_approval_date >= ? AND c.sponsor_approval_date <= ?')
        paramsBase.push(dateLow, dateHigh)
    }

    const wBase = whereBase.join(' AND ')

    // Stats
    const [totalRows] = await pool.query(`SELECT COUNT(*) as cnt FROM customer c WHERE ${wBase}`, paramsBase)
    const total = Number(totalRows?.[0]?.cnt || 0)

    const [pendingRows] = await pool.query(`SELECT COUNT(*) as cnt FROM customer c WHERE ${wBase} AND c.sponsor_approval = 1`, paramsBase)
    const pending = Number(pendingRows?.[0]?.cnt || 0)

    // Total nominal pending (transactions of customers with pending sponsor status)
    let sqlNominal = `
    SELECT SUM(CASE WHEN t.harga_nego > 0 THEN t.harga_nego ELSE t.total_harga END) as total_nominal_pending
    FROM customer c
    JOIN transaksi t ON c.kode_customer = t.kode_customer
    WHERE c.sponsor_approval = 1
  `
    const paramsNominal = []
    if (cabangId) { sqlNominal += ' AND c.cabang = ?'; paramsNominal.push(cabangId) }
    if (marketingId) { sqlNominal += ' AND c.id_marketing = ?'; paramsNominal.push(marketingId) }
    if (dateLow && dateHigh) { sqlNominal += ' AND c.sponsor_approval_date >= ? AND c.sponsor_approval_date <= ?'; paramsNominal.push(dateLow, dateHigh) }

    const [nominalRows] = await pool.query(sqlNominal, paramsNominal)
    const totalNominalPending = Number(nominalRows?.[0]?.total_nominal_pending || 0)

    const [accRows] = await pool.query(`SELECT COUNT(*) as cnt FROM customer c WHERE ${wBase} AND c.sponsor_approval = 2`, paramsBase)
    const acc = Number(accRows?.[0]?.cnt || 0)

    const [tolakRows] = await pool.query(`SELECT COUNT(*) as cnt FROM customer c WHERE ${wBase} AND c.sponsor_approval = 3`, paramsBase)
    const tolak = Number(tolakRows?.[0]?.cnt || 0)

    // Data List
    const whereData = [...whereBase]
    const paramsData = [...paramsBase]

    if (search) {
        whereData.push('(LOWER(c.nama_customer) LIKE ? OR LOWER(c.kode_customer) LIKE ?)')
        const like = `%${String(search).toLowerCase()}%`
        paramsData.push(like, like)
    }

    const wData = whereData.join(' AND ')

    // We map the incoming sorting column name to the aliased or real column
    let orderBySql = 'c.sponsor_approval_date DESC'
    if (orderCol === 'nama_customer') orderBySql = `c.nama_customer ${orderDir}`
    else if (orderCol === 'nama_marketing') orderBySql = `admin.nama_lengkap ${orderDir}`
    else if (orderCol === 'tanggal_input_log') orderBySql = `tanggal_input_log ${orderDir}`
    else if (orderCol === 'total_nominal') orderBySql = `total_nominal ${orderDir}`
    else if (orderCol === 'status') orderBySql = `c.sponsor_approval ${orderDir}`

    const sqlData = `
    SELECT 
      c.kode_customer, 
      c.nama_customer, 
      c.sponsor_approval,
      c.sponsor_approval_date as regdate, 
      admin.nama_lengkap as nama_marketing, 
      cabang_toko.nama_cabang,
      (SELECT SUM(CASE WHEN harga_nego > 0 THEN harga_nego ELSE total_harga END) FROM transaksi WHERE transaksi.kode_customer = c.kode_customer) as total_nominal,
      (SELECT MAX(tanggal_order) FROM transaksi WHERE transaksi.kode_customer = c.kode_customer) as tanggal_input_log
    FROM customer c
    LEFT JOIN admin ON admin.id = c.id_marketing
    LEFT JOIN cabang_toko ON cabang_toko.id_cabang = c.cabang
    WHERE ${wData}
    ORDER BY ${orderBySql}
    ${Number(limit) > 0 ? 'LIMIT ? OFFSET ?' : ''}
  `
    const pData = Number(limit) > 0 ? [...paramsData, Number(limit), Number(offset)] : paramsData
    const [data] = await pool.query(sqlData, pData)

    const [totalFilteredRows] = await pool.query(`SELECT COUNT(*) as cnt FROM customer c WHERE ${wData}`, paramsData)
    const totalFiltered = Number(totalFilteredRows?.[0]?.cnt || 0)

    return {
        stats: { total, pending, total_nominal_pending: totalNominalPending, acc, tolak },
        data,
        total: totalFiltered
    }
}

export async function updateApproval({ kode_customer, action }) {
    // Action: 1 = Pending (Cancel/Reset), 2 = ACC, 3 = Tolak
    let sponsor = '0'
    let sponsor_approval = 1

    if (Number(action) === 2) {
        sponsor = '1'
        sponsor_approval = 2
    } else if (Number(action) === 3) {
        sponsor = '0'
        sponsor_approval = 3
    } else if (Number(action) === 1) {
        sponsor = '0'
        sponsor_approval = 1
    } else {
        throw new Error('Invalid action type')
    }

    // Use the exact current MySQL time or JS time formatting as YYYY-MM-DD HH:MM:SS
    const d = new Date()
    const dateStr = d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0') + ' ' +
        String(d.getHours()).padStart(2, '0') + ':' +
        String(d.getMinutes()).padStart(2, '0') + ':' +
        String(d.getSeconds()).padStart(2, '0')

    const [result] = await pool.query(`
    UPDATE customer 
    SET sponsor = ?, sponsor_approval = ?, sponsor_approval_date = ?
    WHERE kode_customer = ?
  `, [sponsor, sponsor_approval, dateStr, kode_customer])

    return result.affectedRows > 0
}
