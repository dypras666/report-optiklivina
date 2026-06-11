import { pool } from '../db.js'
import { getActivePembukuan } from './pembukuanService.js'

export async function fetchStoreStats({ pembukuanId, cabangId }) {
    const active = await getActivePembukuan(pembukuanId)
    if (!active) return { omset: 0, modal: 0, exp: 0 }

    const params = [active.tanggal_buka_buku, active.tanggal_tutup_buku]
    const whereCabang = cabangId ? ' AND id_cabang = ?' : ''
    if (cabangId) params.push(cabangId)

    // Omset Toko (Grosir)
    const [omsetRows] = await pool.query(
        `SELECT SUM(IFNULL(jumlah_bayar,0)) AS val 
     FROM grosir_pembayaran 
     WHERE tanggal_bayar BETWEEN ? AND ?${whereCabang}`, params)
    const omset = Number(omsetRows?.[0]?.val || 0)

    // Pengeluaran
    const [expRows] = await pool.query(
        `SELECT SUM(IFNULL(total_modal,0)) AS val 
     FROM modal 
     WHERE tanggal_modal BETWEEN ? AND ?${whereCabang}`, params)
    const exp = Number(expRows?.[0]?.val || 0)

    // Modal (HPP Items + Ongkir) for Grosir
    // Note: This logic simplifies HPP calculation from grosir_log
    const [modalRows] = await pool.query(
        `SELECT 
       SUM(
         CASE jenis_produk
           WHEN 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = id_produk) * jumlah
           WHEN 'lensa'    THEN (SELECT harga_modal FROM lensa    WHERE lensa.id_lensa = id_produk) * jumlah
           WHEN 'frame'    THEN (SELECT harga_modal FROM frame    WHERE frame.id_frame = id_produk) * jumlah
           WHEN 'katalog'  THEN (SELECT harga_modal FROM produk   WHERE produk.id_produk = id_produk) * jumlah
           ELSE 0 END
       ) + 
       SUM(
         CASE jenis_produk
           WHEN 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = id_produk) * jumlah
           WHEN 'lensa'    THEN (SELECT harga_ongkir FROM lensa    WHERE lensa.id_lensa = id_produk) * jumlah
           WHEN 'frame'    THEN (SELECT harga_ongkir FROM frame    WHERE frame.id_frame = id_produk) * jumlah
           WHEN 'katalog'  THEN (SELECT harga_ongkir FROM produk   WHERE produk.id_produk = id_produk) * jumlah
           ELSE 0 END
       ) AS val
     FROM grosir_log
     WHERE tanggal_log BETWEEN ? AND ?${cabangId ? ' AND id_cabang = ?' : ''}`, params)
    const modal = Number(modalRows?.[0]?.val || 0)

    return { omset, modal, exp }
}

export async function fetchMarketingStats({ pembukuanId, cabangId }) {
    const active = await getActivePembukuan(pembukuanId)
    if (!active) return { omset: 0, bayar: 0, piutang: 0 }

    const params = [active.tanggal_buka_buku, active.tanggal_tutup_buku]
    const whereCabang = cabangId ? ' AND id_cabang = ?' : ''
    if (cabangId) params.push(cabangId)

    // Omset Marketing (Total Sales Value)
    const [omsetRows] = await pool.query(
        `SELECT SUM((CASE WHEN (harga_nego > 0) THEN harga_nego ELSE total_harga END)) AS val
     FROM transaksi
     WHERE tanggal_order BETWEEN ? AND ?${whereCabang}`, params)
    const omset = Number(omsetRows?.[0]?.val || 0)

    // Bayar Marketing (Payments Received within Period)
    const paramsPay = [active.tanggal_buka_buku, active.tanggal_tutup_buku]
    let joinT = ''
    let whereC = ''
    if (cabangId) {
        joinT = 'LEFT JOIN transaksi t ON t.kode_transaksi = tp.kode_transaksi'
        whereC = ' AND t.id_cabang = ?'
        paramsPay.push(cabangId)
    }
    const [payRows] = await pool.query(
        `SELECT SUM(IFNULL(tp.jumlah_bayar,0)) AS val
     FROM transaksi_pembayaran tp
     ${joinT}
     WHERE tp.tanggal_bayar BETWEEN ? AND ?${whereC}`, paramsPay)
    const bayar = Number(payRows?.[0]?.val || 0)

    // Piutang (Rough estimate: Total Omset in period - Total Payments for those transactions)
    // Or simply fetch total outstanding regardless of period?
    // Request implies "Marketing Turnover", so "Piutang" likely means remaining balance of SALES IN PERIOD.
    // Let's calculate: Total Sisa of transactions IN PERIOD.

    const [receivRows] = await pool.query(
        `SELECT SUM(
       (CASE WHEN (harga_nego > 0) THEN harga_nego ELSE total_harga END) - 
       IFNULL((SELECT SUM(jumlah_bayar) FROM transaksi_pembayaran WHERE kode_transaksi = transaksi.kode_transaksi),0) - 
       IFNULL((SELECT SUM(voucher_use) FROM sponsor_voucher_use WHERE kode_transaksi = transaksi.kode_transaksi),0)
     ) AS val
     FROM transaksi
     WHERE tanggal_order BETWEEN ? AND ?${whereCabang}`, params)
    const piutang = Number(receivRows?.[0]?.val || 0)

    return { omset, bayar, piutang }
}

export async function fetchTopMarketing({ pembukuanId, cabangId, limit = 5 }) {
    const active = await getActivePembukuan(pembukuanId)
    if (!active) return []

    const params = [active.tanggal_buka_buku, active.tanggal_tutup_buku]
    const whereCabang = cabangId ? ' AND t.id_cabang = ?' : ''
    if (cabangId) params.push(cabangId)
    params.push(Number(limit))

    const [rows] = await pool.query(
        `SELECT a.nama_lengkap AS name, SUM(tp.jumlah_bayar) AS value
     FROM transaksi_pembayaran tp
       JOIN transaksi t ON t.kode_transaksi = tp.kode_transaksi
       LEFT JOIN admin a ON a.id = t.id_marketing
     WHERE tp.tanggal_bayar BETWEEN ? AND ?${whereCabang}
     GROUP BY t.id_marketing
     ORDER BY value DESC
     LIMIT ?`, params)
    return rows.map(r => ({ name: r.name || 'Unknown', value: Number(r.value || 0) }))
}

export async function fetchTopProducts({ pembukuanId, cabangId, limit = 5 }) {
    const active = await getActivePembukuan(pembukuanId)
    if (!active) return []

    const params = [active.tanggal_buka_buku, active.tanggal_tutup_buku, active.tanggal_buka_buku, active.tanggal_tutup_buku]
    const whereCabangT = cabangId ? ' AND t.id_cabang = ?' : ''
    const whereCabangG = cabangId ? ' AND g.id_cabang = ?' : ''
    if (cabangId) { params.push(cabangId); params.push(cabangId) }

    // Need to union marketing items and store items (grosir)
    // Marketing items: from transaksi_log join transaksi
    // Store items: from grosir_log join grosir (if grosir is recorded similarly? Actually grosir_log fetches id_grosir=kode_grosir)

    // Simplified: top products by QUANTITY sold in period from BOTH marketing and store
    // Assuming 'transaksi_log' handles marketing sales and 'grosir_log' handles store sales.
    // Wait, `fetchMarketingItems` uses `transaksi_log`. `fetchProfitLoss` uses `grosir_log` too?
    // In `reportsService.js`, `transaksi_log` is for marketing (linked to `transaksi`).
    // `grosir_log` is for store (linked to `grosir`).

    // We can combine them.
    const sql = `
    SELECT name, SUM(qty) AS value FROM (
      SELECT 
        CASE 
          WHEN jenis_produk='katalog' THEN (SELECT nama_produk FROM produk WHERE id_produk=tl.id_produk)
          WHEN jenis_produk='frame' THEN (SELECT CONCAT((SELECT nama_frame FROM frame_kat WHERE id_kat_frame=f.id_kat_frame), ' ', sku_frame) FROM frame f WHERE id_frame=tl.id_produk)
          WHEN jenis_produk='lensa' THEN (SELECT CONCAT(nama_lensa_kat, ' ', size) FROM lensa l JOIN lensa_kat lk ON lk.id_lensa_kat=l.id_lensa_kat WHERE id_lensa=tl.id_produk)
          WHEN jenis_produk='softlens' THEN (SELECT nama_softlens FROM softlens WHERE id_softlens=tl.id_produk)
          ELSE 'Unknown'
        END AS name,
        tl.jumlah AS qty
      FROM transaksi_log tl
        JOIN transaksi t ON t.kode_transaksi = tl.id_grosir OR t.id_transaksi = tl.id_grosir -- Check how id_grosir works in transaksi_log
      WHERE tl.tanggal_log BETWEEN ? AND ?${whereCabangT}
      
      UNION ALL
      
      SELECT 
        CASE 
          WHEN jenis_produk='katalog' THEN (SELECT nama_produk FROM produk WHERE id_produk=gl.id_produk)
          WHEN jenis_produk='frame' THEN (SELECT CONCAT((SELECT nama_frame FROM frame_kat WHERE id_kat_frame=f.id_kat_frame), ' ', sku_frame) FROM frame f WHERE id_frame=gl.id_produk)
          WHEN jenis_produk='lensa' THEN (SELECT CONCAT(nama_lensa_kat, ' ', size) FROM lensa l JOIN lensa_kat lk ON lk.id_lensa_kat=l.id_lensa_kat WHERE id_lensa=gl.id_produk)
          WHEN jenis_produk='softlens' THEN (SELECT nama_softlens FROM softlens WHERE id_softlens=gl.id_produk)
          ELSE 'Unknown'
        END AS name,
        gl.jumlah AS qty
      FROM grosir_log gl
        JOIN grosir g ON g.kode_grosir = gl.id_grosir
      WHERE gl.tanggal_log BETWEEN ? AND ?${whereCabangG}
    ) u
    GROUP BY name
    ORDER BY value DESC
    LIMIT ${Number(limit)}
  `
    // Note: `transaksi_log` uses `id_grosir` column to store `id_transaksi` or `kode_transaksi`.
    // In `fetchMarketingItems`: `WHERE transaksi_log.id_grosir = ? OR ... = (SELECT id from ...)`
    // So it maps to transaction.

    const [rows] = await pool.query(sql, params)
    return rows.map(r => ({ name: r.name || 'Unknown', value: Number(r.value || 0) }))
}
