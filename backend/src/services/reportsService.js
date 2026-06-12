import { pool } from '../db.js'
import { esClient } from '../elasticsearch.js'
import { getActivePembukuan } from './pembukuanService.js'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const ASET_CACHE_TTL_MS = 5 * 60 * 1000
const asetCache = {
  single: new Map(),
  all: { ts: 0, includeIdle: false, data: null },
  idle: new Map(),
  idleAll: new Map()
}

let HAS_CUSTOMER_STATUS_USER_COL = null
async function ensureCustomerStatusUserCol() {
  if (HAS_CUSTOMER_STATUS_USER_COL !== null) return HAS_CUSTOMER_STATUS_USER_COL
  try {
    const [rows] = await pool.query(`SHOW COLUMNS FROM customer LIKE 'status_user'`)
    HAS_CUSTOMER_STATUS_USER_COL = Array.isArray(rows) && rows.length > 0
  } catch (e) {
    HAS_CUSTOMER_STATUS_USER_COL = false
  }
  return HAS_CUSTOMER_STATUS_USER_COL
}
export async function fetchMarketingReports({ pembukuanId, marketingId, cabangId, page = 1, limit = 20, includeSums = false, q, status }) {
  const active = await getActivePembukuan(pembukuanId)
  if (!active) return { data: [], total: 0 }
  
  const offset = Math.max(0, (Number(page) - 1) * Number(limit))
  
  const must = [
    { term: { id_pembukuan: active.id_toko_tutup } },
    { range: { tanggal_order: { gte: active.tanggal_buka_buku.toISOString().split('T')[0], lte: active.tanggal_tutup_buku.toISOString().split('T')[0] } } }
  ]
  
  if (marketingId) must.push({ term: { id_marketing: marketingId } })
  if (cabangId) must.push({ term: { id_cabang: cabangId } })
  if (q) {
    must.push({
      bool: {
        should: [
          { wildcard: { kode_transaksi: `*${q}*` } },
          { wildcard: { nama_customer: `*${q}*` } },
          { wildcard: { nama_lengkap: `*${q}*` } }
        ]
      }
    })
  }
  
  if (status === 'lunas') must.push({ range: { sisa_bayar: { lte: 0 } } })
  if (status === 'belum') must.push({ range: { sisa_bayar: { gt: 0 } } })

  const body = {
    track_total_hits: true,
    query: { bool: { must } },
    sort: [ { id_transaksi: { order: 'desc' } } ],
    from: offset,
    size: Number(limit)
  }

  if (includeSums) {
    body.aggs = {
      sum_fix_harga: { sum: { field: 'fix_harga' } },
      sum_jml_bayar: { sum: { field: 'jml_bayar' } },
      sum_sisa_bayar: { sum: { field: 'sisa_bayar' } },
      sum_ongkir_items: { sum: { field: 'ongkir_items' } },
      sum_laba_items: { sum: { field: 'laba_items' } },
      sum_laba_est: { sum: { field: 'laba_est' } },
      sum_laba_paid: { sum: { field: 'laba_paid' } }
    }
  }

  const res = await esClient.search({
    index: 'optik_marketing_reports',
    body
  })

  const total = res.hits.total.value
  const data = res.hits.hits.map(h => h._source)
  
  const sums = includeSums ? {
    sum_fix_harga: res.aggregations.sum_fix_harga.value,
    sum_jml_bayar: res.aggregations.sum_jml_bayar.value,
    sum_sisa_bayar: res.aggregations.sum_sisa_bayar.value,
    sum_ongkir_items: res.aggregations.sum_ongkir_items.value,
    sum_laba_items: res.aggregations.sum_laba_items.value,
    sum_laba_est: res.aggregations.sum_laba_est.value,
    sum_laba_paid: res.aggregations.sum_laba_paid.value
  } : {}

  return { data, total, sums }
}

export async function fetchMarketingReportsByPaymentPeriod({ pembukuanId, marketingId, cabangId, page = 1, limit = 20, includeSums = false, q, status }) {
  const active = await getActivePembukuan(pembukuanId)
  if (!active) return { data: [], total: 0 }
  
  const offset = Math.max(0, (Number(page) - 1) * Number(limit))
  
  const must = [
    { term: { id_pembukuan: active.id_toko_tutup } },
    { range: { jml_bayar: { gt: 0 } } }
  ]
  
  if (marketingId) must.push({ term: { id_marketing: marketingId } })
  if (cabangId) must.push({ term: { id_cabang: cabangId } })
  if (q) {
    must.push({
      bool: {
        should: [
          { wildcard: { kode_transaksi: `*${q}*` } },
          { wildcard: { nama_customer: `*${q}*` } },
          { wildcard: { nama_lengkap: `*${q}*` } }
        ]
      }
    })
  }
  
  if (status === 'lunas') must.push({ range: { sisa_bayar: { lte: 0 } } })
  if (status === 'belum') must.push({ range: { sisa_bayar: { gt: 0 } } })

  const body = {
    track_total_hits: true,
    query: { bool: { must } },
    sort: [ { id_transaksi: { order: 'desc' } } ],
    from: offset,
    size: Number(limit)
  }

  if (includeSums) {
    body.aggs = {
      sum_fix_harga: { sum: { field: 'fix_harga' } },
      sum_jml_bayar: { sum: { field: 'jml_bayar' } },
      sum_sisa_bayar: { sum: { field: 'sisa_bayar' } },
      sum_ongkir_items: { sum: { field: 'ongkir_items' } },
      sum_laba_items: { sum: { field: 'laba_items' } },
      sum_laba_est: { sum: { field: 'laba_est' } },
      sum_laba_paid: { sum: { field: 'laba_paid' } }
    }
  }

  const res = await esClient.search({
    index: 'optik_marketing_reports',
    body
  })

  const total = res.hits.total.value
  const data = res.hits.hits.map(h => h._source)
  
  const sums = includeSums ? {
    sum_fix_harga: res.aggregations.sum_fix_harga.value,
    sum_jml_bayar: res.aggregations.sum_jml_bayar.value,
    sum_sisa_bayar: res.aggregations.sum_sisa_bayar.value,
    sum_ongkir_items: res.aggregations.sum_ongkir_items.value,
    sum_laba_items: res.aggregations.sum_laba_items.value,
    sum_laba_est: res.aggregations.sum_laba_est.value,
    sum_laba_paid: res.aggregations.sum_laba_paid.value
  } : {}

  return { data, total, sums }
}

export async function fetchCollectorPayments({ pembukuanId, page = 1, limit = 20, q }) {
  const active = await getActivePembukuan(pembukuanId)
  if (!active) return { data: [], total: 0 }
  const offset = Math.max(0, (Number(page) - 1) * Number(limit))
  const paramsPeriod = [active.tanggal_buka_buku, active.tanggal_tutup_buku]
  const paramsWhere = []

  let where = 'WHERE tp.jenis_transaksi = "kolektor" AND tp.tanggal_bayar BETWEEN ? AND ?'
  if (q) {
    where += ' AND (tp.kode_transaksi LIKE ? OR c.nama_customer LIKE ? OR acly.nama_lengkap LIKE ?)'
    const like = `%${q}%`
    paramsWhere.push(like, like, like)
  }

  const sqlData = `
    SELECT 
      tp.id_pembayaran, tp.kode_transaksi, tp.tanggal_bayar, tp.jumlah_bayar, tp.jenis_transaksi,
      tp.id_marketing AS id_kolektor, acly.nama_lengkap AS nama_kolektor,
      t.id_marketing AS id_marketing, amrk.nama_lengkap AS nama_marketing,
      c.kode_customer, c.nama_customer, c.status_user AS status_customer,
      ct.nama_cabang,
      t.keterangan AS keterangan_order,
      tk.keterangan_status,
      tp.tipe_bayar, tp.metode_setor,
      bp.total_poin_digunakan
    FROM transaksi_pembayaran tp
    LEFT JOIN transaksi t ON t.kode_transaksi = tp.kode_transaksi
    LEFT JOIN customer c ON c.kode_customer = t.kode_customer
    LEFT JOIN admin acly ON acly.id = tp.id_marketing
    LEFT JOIN admin amrk ON amrk.id = t.id_marketing
    LEFT JOIN cabang_toko ct ON ct.id_cabang = tp.id_cabang
    LEFT JOIN transaksi_kolektor tk ON tk.kode_transaksi = tp.kode_transaksi
    LEFT JOIN (
      SELECT kode_transaksi, SUM(point_use) as total_poin_digunakan 
      FROM bayar_point 
      GROUP BY kode_transaksi
    ) bp ON bp.kode_transaksi = tp.kode_transaksi
    ${where}
    ORDER BY tp.tanggal_bayar DESC, tp.id_pembayaran DESC
    ${Number(limit) > 0 ? 'LIMIT ? OFFSET ?' : ''}
  `

  const sqlCount = `
    SELECT COUNT(*) AS total
    FROM transaksi_pembayaran tp
    LEFT JOIN transaksi t ON t.kode_transaksi = tp.kode_transaksi
    LEFT JOIN customer c ON c.kode_customer = t.kode_customer
    LEFT JOIN admin acly ON acly.id = tp.id_marketing
    ${where}
  `

  const dataParams = Number(limit) > 0 ? [...paramsPeriod, ...paramsWhere, Number(limit), Number(offset)] : [...paramsPeriod, ...paramsWhere]
  const [rows] = await pool.query(sqlData, dataParams)
  const [countRows] = await pool.query(sqlCount, [...paramsPeriod, ...paramsWhere])

  return { data: rows, total: Number(countRows?.[0]?.total || 0) }
}

export async function fetchProfitLossDetails({ pembukuanId, cabangId }) {
  const active = await getActivePembukuan(pembukuanId)
  if (!active) return []
  const paramsInner = [active.tanggal_buka_buku, active.tanggal_tutup_buku, active.tanggal_buka_buku, active.tanggal_tutup_buku]
  if (cabangId) paramsInner.push(cabangId)
  const whereCabang = cabangId ? ' AND t.id_cabang = ?' : ''
  const inner = `
    SELECT 
      CASE 
        WHEN tl.jenis_produk = 'katalog' THEN (SELECT CONCAT(nama_produk, ' (', sku_katalog, ')') FROM produk WHERE produk.id_produk = tl.id_produk)
        WHEN tl.jenis_produk = 'softlens' THEN (SELECT CONCAT(nama_softlens, ' (', sku_softlens, ')') FROM softlens WHERE softlens.id_softlens = tl.id_produk)
        WHEN tl.jenis_produk = 'lensa' THEN (SELECT CONCAT(nama_lensa_kat, ' ', size, ' | ', sku_lensa) FROM (SELECT id_lensa, sku_lensa, nama_lensa_kat, size FROM lensa JOIN lensa_kat ON lensa_kat.id_lensa_kat=lensa.id_lensa_kat) l WHERE l.id_lensa = tl.id_produk)
        WHEN tl.jenis_produk = 'frame' THEN (SELECT CONCAT((SELECT nama_frame FROM frame_kat WHERE frame_kat.id_kat_frame = f.id_kat_frame), ' (', sku_frame, ')') FROM frame f WHERE f.id_frame = tl.id_produk)
        ELSE CONCAT('ID ', tl.id_produk)
      END AS nama_produk,
      (CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) AS fix_harga,
      IFNULL(tp.jml_bayar,0) AS jml_bayar,
      IFNULL(svu.total_voucher,0) AS total_voucher,
      tl.tanggal_log AS tanggal_log,
      (CASE WHEN tl.jumlah_harga = 0 THEN (tl.harga_produk * tl.jumlah) ELSE tl.jumlah_harga END) AS item_amount,
      (CASE tl.jenis_produk
         WHEN 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = tl.id_produk) * tl.jumlah
         WHEN 'lensa'    THEN (SELECT harga_modal FROM lensa    WHERE lensa.id_lensa = tl.id_produk) * tl.jumlah
         WHEN 'frame'    THEN (SELECT harga_modal FROM frame    WHERE frame.id_frame = tl.id_produk) * tl.jumlah
         WHEN 'katalog'  THEN (SELECT harga_modal FROM produk   WHERE produk.id_produk = tl.id_produk) * tl.jumlah
         ELSE 0 END) AS modal_total,
      (CASE tl.jenis_produk
         WHEN 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = tl.id_produk) * tl.jumlah
         WHEN 'lensa'    THEN (SELECT harga_ongkir FROM lensa    WHERE lensa.id_lensa = tl.id_produk) * tl.jumlah
         WHEN 'frame'    THEN (SELECT harga_ongkir FROM frame    WHERE frame.id_frame = tl.id_produk) * tl.jumlah
         WHEN 'katalog'  THEN (SELECT harga_ongkir FROM produk   WHERE produk.id_produk = tl.id_produk) * tl.jumlah
         ELSE 0 END) AS ongkir_total
    FROM transaksi_log tl
      LEFT JOIN transaksi t ON t.id_transaksi = tl.id_grosir OR t.kode_transaksi = tl.id_grosir
      LEFT JOIN (
        SELECT kode_transaksi, SUM(jumlah_bayar + IFNULL(bayar_lain, 0) + IFNULL(potong_marketing, 0)) AS jml_bayar
        FROM transaksi_pembayaran
        WHERE tanggal_bayar BETWEEN ? AND ?
        GROUP BY kode_transaksi
      ) tp ON tp.kode_transaksi = t.kode_transaksi
      LEFT JOIN (
        SELECT kode_transaksi, SUM(voucher_use) AS total_voucher
        FROM sponsor_voucher_use
        GROUP BY kode_transaksi
      ) svu ON svu.kode_transaksi = t.kode_transaksi
    WHERE tl.tanggal_log BETWEEN ? AND ?${whereCabang}
  `
  const sql = `
    SELECT s.nama_produk, s.fix_harga, s.jml_bayar, s.total_voucher,
           (s.fix_harga - s.jml_bayar - s.total_voucher) AS sisa_bayar,
           s.modal_total,
           (CASE WHEN (s.fix_harga - s.jml_bayar - s.total_voucher) <= 0 THEN (s.item_amount - (s.modal_total + s.ongkir_total)) ELSE 0 END) AS laba_aktual,
           (CASE WHEN (s.fix_harga - s.jml_bayar - s.total_voucher) > 0 
                 THEN ((IFNULL(s.jml_bayar,0) + IFNULL(s.total_voucher,0) + 0.0) / s.fix_harga) * (s.item_amount - (s.modal_total + s.ongkir_total))
                 ELSE 0 END) AS laba_estimasi,
           (s.item_amount - (s.modal_total + s.ongkir_total)) AS laba_akumulasi
    FROM (${inner}) s
    ORDER BY s.tanggal_log DESC`
  const [rows] = await pool.query(sql, paramsInner)
  return rows
}

export async function fetchTokoReports({ pembukuanId, cabangId, page = 1, limit = 50 }) {
  const active = await getActivePembukuan(pembukuanId)
  if (!active) return { data: [], total: 0 }
  const offset = Math.max(0, (Number(page) - 1) * Number(limit))
  const paramsBase = [active.tanggal_buka_buku, active.tanggal_tutup_buku]
  const paramsWhere = [active.tanggal_buka_buku, active.tanggal_tutup_buku]

  let whereTransaksi = 'WHERE 1=1'
  whereTransaksi += ' AND transaksi.tanggal_order BETWEEN ? AND ?'
  if (cabangId) { whereTransaksi += ' AND transaksi.id_cabang = ?'; paramsWhere.push(cabangId) }

  const hasStatusUser = await ensureCustomerStatusUserCol()
  const baseJoin = `
    FROM transaksi
    LEFT JOIN (
      SELECT kode_transaksi, SUM(jumlah_bayar + IFNULL(bayar_lain, 0) + IFNULL(potong_marketing, 0)) AS jml_bayar,
             MAX(jenis_transaksi) AS jenis_transaksi,
             MAX(tanggal_bayar) AS tanggal_bayar
      FROM transaksi_pembayaran
      WHERE tanggal_bayar BETWEEN ? AND ?
        AND jenis_transaksi NOT IN ('piutang')
      GROUP BY kode_transaksi
    ) tp ON tp.kode_transaksi = transaksi.kode_transaksi
    LEFT JOIN (
      SELECT kode_transaksi, SUM(voucher_use) AS total_voucher
      FROM sponsor_voucher_use
      GROUP BY kode_transaksi
    ) svu ON svu.kode_transaksi = transaksi.kode_transaksi
    LEFT JOIN (
      SELECT id_grosir,
             SUM(jumlah_harga) AS sum_jumlah_harga,
             SUM(
               CASE jenis_produk
                 WHEN 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = transaksi_log.id_produk) * jumlah
                 WHEN 'lensa'    THEN (SELECT harga_modal FROM lensa    WHERE lensa.id_lensa = transaksi_log.id_produk) * jumlah
                 WHEN 'frame'    THEN (SELECT harga_modal FROM frame    WHERE frame.id_frame = transaksi_log.id_produk) * jumlah
                 WHEN 'katalog'  THEN (SELECT harga_modal FROM produk   WHERE produk.id_produk = transaksi_log.id_produk) * jumlah
                 ELSE 0
               END
              ) AS sum_modal,
              SUM(
                CASE jenis_produk
                  WHEN 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = transaksi_log.id_produk) * jumlah
                  WHEN 'lensa'    THEN (SELECT harga_ongkir FROM lensa    WHERE lensa.id_lensa = transaksi_log.id_produk) * jumlah
                  WHEN 'frame'    THEN (SELECT harga_ongkir FROM frame    WHERE frame.id_frame = transaksi_log.id_produk) * jumlah
                  WHEN 'katalog'  THEN (SELECT harga_ongkir FROM produk   WHERE produk.id_produk = transaksi_log.id_produk) * jumlah
                  ELSE 0
                END
              ) AS sum_ongkir
      FROM transaksi_log
      WHERE transaksi_log.tanggal_log BETWEEN ? AND ?
      GROUP BY id_grosir
    ) it ON it.id_grosir = transaksi.kode_transaksi OR it.id_grosir = transaksi.id_transaksi
    LEFT JOIN customer ON customer.kode_customer = transaksi.kode_customer
    LEFT JOIN cabang_toko ON cabang_toko.id_cabang = transaksi.id_cabang
    ${whereTransaksi}
  `

  const sqlData = `
    SELECT cabang_toko.id_cabang, cabang_toko.nama_cabang,
           COUNT(transaksi.id_transaksi) AS total_transaksi,
           SUM((CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END)) AS sum_fix_harga,
           SUM(IFNULL(tp.jml_bayar,0)) AS sum_jml_bayar,
           SUM(IFNULL(svu.total_voucher,0)) AS sum_total_voucher,
           SUM((CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) - IFNULL(tp.jml_bayar,0) - IFNULL(svu.total_voucher,0)) AS sum_sisa_bayar,
           SUM(IFNULL(it.sum_ongkir,0)) AS sum_ongkir_items,
           SUM(COALESCE((CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) - (IFNULL(it.sum_modal,0) + IFNULL(it.sum_ongkir,0)), 0)) AS sum_laba_items,
           SUM(CASE WHEN ((CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) - IFNULL(tp.jml_bayar,0) - IFNULL(svu.total_voucher,0)) > 0 
                     THEN COALESCE((CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) - (IFNULL(it.sum_modal,0) + IFNULL(it.sum_ongkir,0)), 0) ELSE 0 END) AS sum_laba_belum_lunas,
           SUM(CASE WHEN ((CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) - IFNULL(tp.jml_bayar,0) - IFNULL(svu.total_voucher,0)) <= 0 AND UPPER(tp.jenis_transaksi) = 'GL'
                     THEN COALESCE((CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) - (IFNULL(it.sum_modal,0) + IFNULL(it.sum_ongkir,0)), 0) ELSE 0 END) AS sum_laba_sudah_lunas,
           SUM(CASE 
                 WHEN ((CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) - IFNULL(tp.jml_bayar,0) - IFNULL(svu.total_voucher,0)) > 0
                  AND TIMESTAMPDIFF(MONTH, COALESCE(tp.tanggal_bayar, transaksi.tanggal_order), CURDATE()) <= 1
                 THEN (CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) - IFNULL(tp.jml_bayar,0) - IFNULL(svu.total_voucher,0)
                 ELSE 0 END) AS tagihan_1_bulan,
           SUM(CASE 
                 WHEN ((CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) - IFNULL(tp.jml_bayar,0) - IFNULL(svu.total_voucher,0)) > 0
                  AND TIMESTAMPDIFF(MONTH, COALESCE(tp.tanggal_bayar, transaksi.tanggal_order), CURDATE()) > 1
                  AND TIMESTAMPDIFF(MONTH, COALESCE(tp.tanggal_bayar, transaksi.tanggal_order), CURDATE()) <= 3
                 THEN (CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) - IFNULL(tp.jml_bayar,0) - IFNULL(svu.total_voucher,0)
                 ELSE 0 END) AS tagihan_3_bulan,
           SUM(CASE 
                 WHEN ((CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) - IFNULL(tp.jml_bayar,0) - IFNULL(svu.total_voucher,0)) > 0
                  AND TIMESTAMPDIFF(MONTH, COALESCE(tp.tanggal_bayar, transaksi.tanggal_order), CURDATE()) > 3
                  AND TIMESTAMPDIFF(MONTH, COALESCE(tp.tanggal_bayar, transaksi.tanggal_order), CURDATE()) <= 6
                 THEN (CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) - IFNULL(tp.jml_bayar,0) - IFNULL(svu.total_voucher,0)
                 ELSE 0 END) AS tagihan_6_bulan,
           SUM(CASE 
                 WHEN ((CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) - IFNULL(tp.jml_bayar,0) - IFNULL(svu.total_voucher,0)) > 0
                  AND TIMESTAMPDIFF(MONTH, COALESCE(tp.tanggal_bayar, transaksi.tanggal_order), CURDATE()) > 6
                  AND TIMESTAMPDIFF(MONTH, COALESCE(tp.tanggal_bayar, transaksi.tanggal_order), CURDATE()) <= 12
                 THEN (CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) - IFNULL(tp.jml_bayar,0) - IFNULL(svu.total_voucher,0)
                 ELSE 0 END) AS tagihan_1_tahun,
           SUM(CASE 
                 WHEN ((CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) - IFNULL(tp.jml_bayar,0) - IFNULL(svu.total_voucher,0)) > 0
                  AND TIMESTAMPDIFF(MONTH, COALESCE(tp.tanggal_bayar, transaksi.tanggal_order), CURDATE()) > 12
                 THEN (CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) - IFNULL(tp.jml_bayar,0) - IFNULL(svu.total_voucher,0)
                 ELSE 0 END) AS tagihan_gt_1_tahun
    ${baseJoin} ${hasStatusUser ? "AND (customer.status_user IS NULL OR LOWER(customer.status_user) <> 'blacklist')" : ''}
    GROUP BY cabang_toko.id_cabang, cabang_toko.nama_cabang
    ORDER BY cabang_toko.nama_cabang ASC
    LIMIT ? OFFSET ?
  `
  const sqlCount = `
    SELECT COUNT(DISTINCT cabang_toko.id_cabang) AS total
    ${baseJoin} ${hasStatusUser ? "AND (customer.status_user IS NULL OR LOWER(customer.status_user) <> 'blacklist')" : ''}
  `

  const paramsItems = [active.tanggal_buka_buku, active.tanggal_tutup_buku]
  const [rows] = await pool.query(sqlData, [...paramsBase, ...paramsItems, ...paramsWhere, Number(limit), Number(offset)])
  const [countRows] = await pool.query(sqlCount, [...paramsBase, ...paramsItems, ...paramsWhere])
  const total = Number(countRows?.[0]?.total || 0)
  let prevStartStr = null
  let prevEndStr = null
  if (active?.id_toko_tutup) {
    try {
      const prevQuery = Number.isInteger(pembukuanId)
        ? ['SELECT tanggal_buka_buku, tanggal_tutup_buku FROM toko_tutup_buku WHERE id_toko_tutup < ? ORDER BY id_toko_tutup DESC LIMIT 1', [active.id_toko_tutup]]
        : ['SELECT tanggal_buka_buku, tanggal_tutup_buku FROM toko_tutup_buku ORDER BY id_toko_tutup DESC LIMIT 2', []]
      const [prevRowsRaw] = await pool.query(prevQuery[0], prevQuery[1])
      const prevRow = Number.isInteger(pembukuanId) ? (prevRowsRaw?.[0] || null) : (prevRowsRaw?.[1] || null)
      if (prevRow) {
        prevStartStr = String(prevRow.tanggal_buka_buku)
        prevEndStr = String(prevRow.tanggal_tutup_buku)
      }
    } catch { }
  }
  const paramsPrev = prevStartStr && prevEndStr ? [prevStartStr, prevEndStr] : []
  const paramsPrevWhere = prevStartStr && prevEndStr ? [prevStartStr, prevEndStr] : []
  if (prevStartStr && prevEndStr && cabangId) paramsPrevWhere.push(cabangId)
  const sqlPrev = `
    SELECT cabang_toko.id_cabang,
           SUM((CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END)) AS sum_fix_harga_prev,
           SUM(IFNULL(tp.jml_bayar,0)) AS sum_jml_bayar_prev
    ${baseJoin.replaceAll('BETWEEN ? AND ?', 'BETWEEN ? AND ?')}
    GROUP BY cabang_toko.id_cabang
  `
  const [prevRows] = paramsPrev.length > 0 ? await pool.query(sqlPrev, [...paramsPrev, ...paramsPrev, ...paramsPrevWhere]) : [[]]
  const prevMap = new Map(prevRows.map(r => [Number(r.id_cabang), { sum_fix_harga_prev: Number(r.sum_fix_harga_prev || 0), sum_jml_bayar_prev: Number(r.sum_jml_bayar_prev || 0) }]))
  // Aging tanpa batasan periode pembukuan (semua transaksi belum lunas)
  const sqlAgingAll = `
    SELECT t.id_cabang,
           SUM(CASE 
                 WHEN ((CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) - IFNULL(tp2.jml_bayar,0)) > 0
                  AND TIMESTAMPDIFF(MONTH, COALESCE(tp2.tanggal_bayar, t.tanggal_order), CURDATE()) <= 1
                 THEN (CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) - IFNULL(tp2.jml_bayar,0)
                 ELSE 0 END) AS tagihan_1_bulan,
           SUM(CASE 
                 WHEN ((CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) - IFNULL(tp2.jml_bayar,0)) > 0
                  AND TIMESTAMPDIFF(MONTH, COALESCE(tp2.tanggal_bayar, t.tanggal_order), CURDATE()) > 1
                  AND TIMESTAMPDIFF(MONTH, COALESCE(tp2.tanggal_bayar, t.tanggal_order), CURDATE()) <= 3
                 THEN (CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) - IFNULL(tp2.jml_bayar,0)
                 ELSE 0 END) AS tagihan_3_bulan,
           SUM(CASE 
                 WHEN ((CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) - IFNULL(tp2.jml_bayar,0)) > 0
                  AND TIMESTAMPDIFF(MONTH, COALESCE(tp2.tanggal_bayar, t.tanggal_order), CURDATE()) > 3
                  AND TIMESTAMPDIFF(MONTH, COALESCE(tp2.tanggal_bayar, t.tanggal_order), CURDATE()) <= 6
                 THEN (CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) - IFNULL(tp2.jml_bayar,0)
                 ELSE 0 END) AS tagihan_6_bulan,
           SUM(CASE 
                 WHEN ((CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) - IFNULL(tp2.jml_bayar,0)) > 0
                  AND TIMESTAMPDIFF(MONTH, COALESCE(tp2.tanggal_bayar, t.tanggal_order), CURDATE()) > 6
                  AND TIMESTAMPDIFF(MONTH, COALESCE(tp2.tanggal_bayar, t.tanggal_order), CURDATE()) <= 12
                 THEN (CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) - IFNULL(tp2.jml_bayar,0)
                 ELSE 0 END) AS tagihan_1_tahun,
           SUM(CASE 
                 WHEN ((CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) - IFNULL(tp2.jml_bayar,0)) > 0
                  AND TIMESTAMPDIFF(MONTH, COALESCE(tp2.tanggal_bayar, t.tanggal_order), CURDATE()) > 12
                 THEN (CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) - IFNULL(tp2.jml_bayar,0)
                 ELSE 0 END) AS tagihan_gt_1_tahun
    FROM transaksi t
      LEFT JOIN (
        SELECT kode_transaksi,
               SUM(IFNULL(jumlah_bayar,0)) AS jml_bayar,
               MAX(tanggal_bayar) AS tanggal_bayar
        FROM transaksi_pembayaran
        WHERE (jenis_transaksi IS NULL OR UPPER(jenis_transaksi) <> 'PIUTANG')
        GROUP BY kode_transaksi
      ) tp2 ON tp2.kode_transaksi = t.kode_transaksi
    ${cabangId ? 'WHERE t.id_cabang = ?' : ''}
    GROUP BY t.id_cabang
  `
  const agingParams = []
  if (cabangId) agingParams.push(cabangId)
  const [agingRows] = await pool.query(sqlAgingAll, agingParams)
  const agingMap = new Map(agingRows.map(r => [Number(r.id_cabang), r]))
  const merged = rows.map(r => {
    const a = agingMap.get(Number(r.id_cabang)) || {}
    const p = prevMap.get(Number(r.id_cabang)) || { sum_fix_harga_prev: 0, sum_jml_bayar_prev: 0 }
    const pct_bayar = Number(r.sum_fix_harga || 0) > 0 ? (Number(r.sum_jml_bayar || 0) / Number(r.sum_fix_harga || 0)) : 0
    const pct_prev = Number(p.sum_fix_harga_prev || 0) > 0 ? (Number(p.sum_jml_bayar_prev || 0) / Number(p.sum_fix_harga_prev || 0)) : 0
    const pct_delta = pct_bayar - pct_prev
    return {
      ...r,
      tagihan_1_bulan: Number(a.tagihan_1_bulan || r.tagihan_1_bulan || 0),
      tagihan_3_bulan: Number(a.tagihan_3_bulan || r.tagihan_3_bulan || 0),
      tagihan_6_bulan: Number(a.tagihan_6_bulan || r.tagihan_6_bulan || 0),
      tagihan_1_tahun: Number(a.tagihan_1_tahun || r.tagihan_1_tahun || 0),
      tagihan_gt_1_tahun: Number(a.tagihan_gt_1_tahun || r.tagihan_gt_1_tahun || 0),
      pct_bayar,
      pct_prev,
      pct_delta
    }
  })
  return { data: merged, total }
}

export async function fetchTokoTransaksiReports({ pembukuanId, cabangId, page = 1, limit = 50, q, status }) {
  const active = await getActivePembukuan(pembukuanId)
  if (!active) return { data: [], total: 0 }
  const offset = Math.max(0, (Number(page) - 1) * Number(limit))
  const paramsPeriod = [active.tanggal_buka_buku, active.tanggal_tutup_buku]
  let where = 'WHERE g.tanggal_grosir BETWEEN ? AND ?'
  const params = [...paramsPeriod]
  if (cabangId) { where += ' AND g.id_cabang = ?'; params.push(cabangId) }
  if (q) { where += ' AND (g.kode_grosir LIKE ? OR cabang_toko.nama_cabang LIKE ?)'; const like = `%${q}%`; params.push(like, like) }

  const statusExpr = `((IFNULL(gl.sum_jumlah_harga,0)) - IFNULL(gp.jml_bayar,0))`
  if (status === 'lunas') { where += ` AND ${statusExpr} <= 0` }
  if (status === 'belum') { where += ` AND ${statusExpr} > 0` }
  const hasStatusUser = await ensureCustomerStatusUserCol()
  if (hasStatusUser) {
    where += " AND (c.status_user IS NULL OR LOWER(c.status_user) <> 'blacklist')"
  }

  const sql = `
    SELECT g.kode_grosir, g.tanggal_grosir, g.id_cabang, cabang_toko.nama_cabang,
           IFNULL(gl.sum_jumlah_harga,0) AS fix_harga,
           IFNULL(gp.jml_bayar,0) AS jml_bayar,
           (IFNULL(gl.sum_jumlah_harga,0) - IFNULL(gp.jml_bayar,0)) AS sisa_bayar,
           IFNULL(gl.sum_modal,0) AS sum_modal,
           IFNULL(gl.sum_qty,0) AS sum_qty
    FROM grosir g
      LEFT JOIN cabang_toko ON cabang_toko.id_cabang = g.id_cabang
      LEFT JOIN customer c ON c.kode_customer = g.kode_customer
      LEFT JOIN (
        SELECT id_grosir,
               SUM(jumlah_harga) AS sum_jumlah_harga,
               SUM(jumlah) AS sum_qty,
               SUM(
                 CASE jenis_produk
                   WHEN 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = grosir_log.id_produk) * jumlah
                   WHEN 'lensa'    THEN (SELECT harga_modal FROM lensa    WHERE lensa.id_lensa = grosir_log.id_produk) * jumlah
                   WHEN 'frame'    THEN (SELECT harga_modal FROM frame    WHERE frame.id_frame = grosir_log.id_produk) * jumlah
                   WHEN 'katalog'  THEN (SELECT harga_modal FROM produk   WHERE produk.id_produk = grosir_log.id_produk) * jumlah
                   ELSE 0
                 END
               ) AS sum_modal
        FROM grosir_log
        WHERE tanggal_log BETWEEN ? AND ?
        GROUP BY id_grosir
      ) gl ON gl.id_grosir = g.kode_grosir
      LEFT JOIN (
        SELECT id_cabang, kode_grosir, SUM(jumlah_bayar + IFNULL(bayar_lain, 0) + IFNULL(potong_marketing, 0)) AS jml_bayar
        FROM grosir_pembayaran
        WHERE tanggal_bayar BETWEEN ? AND ?
        GROUP BY id_cabang, kode_grosir
      ) gp ON gp.kode_grosir = g.kode_grosir AND gp.id_cabang = g.id_cabang
    ${where}
    ORDER BY g.tanggal_grosir DESC, g.kode_grosir DESC
    LIMIT ? OFFSET ?`

  const [rows] = await pool.query(sql, [...paramsPeriod, ...paramsPeriod, ...params, Number(limit), Number(offset)])
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM grosir g
       LEFT JOIN cabang_toko ON cabang_toko.id_cabang = g.id_cabang
       LEFT JOIN customer c ON c.kode_customer = g.kode_customer
     ${where.replace(statusExpr, '((0))')}`,
    params
  )
  const total = Number(countRows?.[0]?.total || 0)
  return { data: rows, total }
}

export async function fetchOmsetToko({ pembukuanId, cabangId, page = 1, limit = 50 }) {
  const active = await getActivePembukuan(pembukuanId)
  if (!active) return { data: [], total: 0 }
  const offset = Math.max(0, (Number(page) - 1) * Number(limit))

  const paramsBase = [active.tanggal_buka_buku, active.tanggal_tutup_buku]
  const paramsCabang = []
  if (cabangId) paramsCabang.push(cabangId)

  const [cabangRows] = await pool.query(`SELECT id_cabang, nama_cabang FROM cabang_toko`)
  const cabangNameMap = new Map(cabangRows.map(r => [Number(r.id_cabang), r.nama_cabang]))

  const hasStatusUser = await ensureCustomerStatusUserCol()

  const [omsetRows] = await pool.query(
    `SELECT gp.id_cabang, ct.nama_cabang, SUM(IFNULL(gp.jumlah_bayar,0)) AS total_omset
     FROM grosir_pembayaran gp
       JOIN grosir g ON g.kode_grosir = gp.kode_grosir AND g.id_cabang = gp.id_cabang
       LEFT JOIN customer c ON c.kode_customer = g.kode_customer
       LEFT JOIN cabang_toko ct ON ct.id_cabang = gp.id_cabang
     WHERE gp.tanggal_bayar BETWEEN ? AND ?
       ${cabangId ? 'AND gp.id_cabang = ?' : ''}
       ${hasStatusUser ? "AND (c.status_user IS NULL OR LOWER(c.status_user) <> 'blacklist')" : ''}
     GROUP BY gp.id_cabang, ct.nama_cabang
     ORDER BY ct.nama_cabang ASC`,
    [...paramsBase, ...paramsCabang]
  )

  const [trxRows] = await pool.query(
    `SELECT g.id_cabang, COUNT(*) AS num_trx
     FROM grosir g
     WHERE g.tanggal_grosir BETWEEN ? AND ?
       ${cabangId ? 'AND g.id_cabang = ?' : ''}
     GROUP BY g.id_cabang`,
    [...paramsBase, ...paramsCabang]
  )

  const [custRows] = await pool.query(
    `SELECT customer.cabang AS id_cabang, COUNT(*) AS num_customer
     FROM customer
     WHERE customer.tanggal_daftar BETWEEN ? AND ?
       ${cabangId ? 'AND customer.cabang = ?' : ''}
     GROUP BY customer.cabang`,
    [...paramsBase, ...paramsCabang]
  )

  const [kmRows] = await pool.query(
    `SELECT g.id_cabang, SUM(IFNULL(gp.jumlah_bayar,0)) AS total_kacamata
     FROM grosir_pembayaran gp
       JOIN grosir g ON g.kode_grosir = gp.kode_grosir
       LEFT JOIN customer c ON c.kode_customer = g.kode_customer
     WHERE gp.tanggal_bayar BETWEEN ? AND ? AND g.tipe_transaksi = 'kacamata'
       ${cabangId ? 'AND g.id_cabang = ?' : ''}
       ${hasStatusUser ? "AND (c.status_user IS NULL OR LOWER(c.status_user) <> 'blacklist')" : ''}
     GROUP BY g.id_cabang`,
    [...paramsBase, ...paramsCabang]
  )

  const [glRows] = await pool.query(
    `SELECT g.id_cabang, SUM(IFNULL(gp.jumlah_bayar,0)) AS total_ganti_lensa
     FROM grosir_pembayaran gp
       JOIN grosir g ON g.kode_grosir = gp.kode_grosir
       LEFT JOIN customer c ON c.kode_customer = g.kode_customer
     WHERE gp.tanggal_bayar BETWEEN ? AND ? AND g.tipe_transaksi = 'ganti_lensa'
       ${cabangId ? 'AND g.id_cabang = ?' : ''}
       ${hasStatusUser ? "AND (c.status_user IS NULL OR LOWER(c.status_user) <> 'blacklist')" : ''}
     GROUP BY g.id_cabang`,
    [...paramsBase, ...paramsCabang]
  )

  const [gfRows] = await pool.query(
    `SELECT g.id_cabang, SUM(IFNULL(gp.jumlah_bayar,0)) AS total_ganti_frame
     FROM grosir_pembayaran gp
       JOIN grosir g ON g.kode_grosir = gp.kode_grosir
       LEFT JOIN customer c ON c.kode_customer = g.kode_customer
     WHERE gp.tanggal_bayar BETWEEN ? AND ? AND g.tipe_transaksi = 'ganti_frame'
       ${cabangId ? 'AND g.id_cabang = ?' : ''}
       ${hasStatusUser ? "AND (c.status_user IS NULL OR LOWER(c.status_user) <> 'blacklist')" : ''}
     GROUP BY g.id_cabang`,
    [...paramsBase, ...paramsCabang]
  )

  const [slRows] = await pool.query(
    `SELECT gl.id_cabang, SUM(
        CASE WHEN gl.jumlah_harga = 0 THEN (gl.harga_produk * gl.jumlah)
             ELSE gl.jumlah_harga END
      ) AS total_softlens
     FROM grosir_log gl
       JOIN grosir g ON g.kode_grosir = gl.id_grosir
       LEFT JOIN customer c ON c.kode_customer = g.kode_customer
     WHERE gl.tanggal_log BETWEEN ? AND ? AND gl.jenis_produk = 'softlens'
       ${cabangId ? 'AND gl.id_cabang = ?' : ''}
       ${hasStatusUser ? "AND (c.status_user IS NULL OR LOWER(c.status_user) <> 'blacklist')" : ''}
     GROUP BY gl.id_cabang`,
    [...paramsBase, ...paramsCabang]
  )

  const [ongkirRows] = await pool.query(
    `SELECT gl.id_cabang, SUM(
        CASE gl.jenis_produk
          WHEN 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = gl.id_produk) * gl.jumlah
          WHEN 'lensa'    THEN (SELECT harga_ongkir FROM lensa    WHERE lensa.id_lensa = gl.id_produk) * gl.jumlah
          WHEN 'frame'    THEN (SELECT harga_ongkir FROM frame    WHERE frame.id_frame = gl.id_produk) * gl.jumlah
          WHEN 'katalog'  THEN (SELECT harga_ongkir FROM produk   WHERE produk.id_produk = gl.id_produk) * gl.jumlah
          ELSE 0
        END
      ) AS total_ongkir
     FROM grosir_log gl
       JOIN grosir g ON g.kode_grosir = gl.id_grosir
       LEFT JOIN customer c ON c.kode_customer = g.kode_customer
     WHERE gl.tanggal_log BETWEEN ? AND ?
       ${cabangId ? 'AND gl.id_cabang = ?' : ''}
       ${hasStatusUser ? "AND (c.status_user IS NULL OR LOWER(c.status_user) <> 'blacklist')" : ''}
     GROUP BY gl.id_cabang`,
    [...paramsBase, ...paramsCabang]
  )

  const [kmQtyRows] = await pool.query(
    `SELECT g.id_cabang, SUM(gl.jumlah) AS qty_kacamata
     FROM grosir_log gl
       JOIN grosir g ON g.kode_grosir = gl.id_grosir
       LEFT JOIN customer c ON c.kode_customer = g.kode_customer
     WHERE gl.tanggal_log BETWEEN ? AND ? AND g.tipe_transaksi = 'kacamata'
       ${cabangId ? 'AND gl.id_cabang = ?' : ''}
       ${hasStatusUser ? "AND (c.status_user IS NULL OR LOWER(c.status_user) <> 'blacklist')" : ''}
     GROUP BY g.id_cabang`,
    [...paramsBase, ...paramsCabang]
  )

  const [glQtyRows] = await pool.query(
    `SELECT g.id_cabang, SUM(gl.jumlah) AS qty_ganti_lensa
     FROM grosir_log gl
       JOIN grosir g ON g.kode_grosir = gl.id_grosir
       LEFT JOIN customer c ON c.kode_customer = g.kode_customer
     WHERE gl.tanggal_log BETWEEN ? AND ? AND g.tipe_transaksi = 'ganti_lensa'
       ${cabangId ? 'AND gl.id_cabang = ?' : ''}
       ${hasStatusUser ? "AND (c.status_user IS NULL OR LOWER(c.status_user) <> 'blacklist')" : ''}
     GROUP BY g.id_cabang`,
    [...paramsBase, ...paramsCabang]
  )

  const [gfQtyRows] = await pool.query(
    `SELECT g.id_cabang, SUM(gl.jumlah) AS qty_ganti_frame
     FROM grosir_log gl
       JOIN grosir g ON g.kode_grosir = gl.id_grosir
       LEFT JOIN customer c ON c.kode_customer = g.kode_customer
     WHERE gl.tanggal_log BETWEEN ? AND ? AND g.tipe_transaksi = 'ganti_frame'
       ${cabangId ? 'AND gl.id_cabang = ?' : ''}
       ${hasStatusUser ? "AND (c.status_user IS NULL OR LOWER(c.status_user) <> 'blacklist')" : ''}
     GROUP BY g.id_cabang`,
    [...paramsBase, ...paramsCabang]
  )

  const [slQtyRows] = await pool.query(
    `SELECT gl.id_cabang, SUM(gl.jumlah) AS qty_softlens
     FROM grosir_log gl
       JOIN grosir g ON g.kode_grosir = gl.id_grosir
       LEFT JOIN customer c ON c.kode_customer = g.kode_customer
     WHERE gl.tanggal_log BETWEEN ? AND ? AND gl.jenis_produk = 'softlens'
       ${cabangId ? 'AND gl.id_cabang = ?' : ''}
       ${hasStatusUser ? "AND (c.status_user IS NULL OR LOWER(c.status_user) <> 'blacklist')" : ''}
     GROUP BY gl.id_cabang`,
    [...paramsBase, ...paramsCabang]
  )

  const map = new Map()
  const ensure = (id) => {
    const key = Number(id)
    const cur = map.get(key)
    if (cur) return cur
    const nama = cabangNameMap.get(key) || ''
    const init = { id_cabang: key, nama_cabang: nama, total_omset: 0, total_ongkir: 0, num_trx: 0, num_customer: 0, total_kacamata: 0, total_ganti_lensa: 0, total_ganti_frame: 0, total_softlens: 0, qty_kacamata: 0, qty_ganti_lensa: 0, qty_ganti_frame: 0, qty_softlens: 0 }
    map.set(key, init)
    return init
  }
  for (const r of omsetRows) { const m = ensure(r.id_cabang); m.nama_cabang = r.nama_cabang || cabangNameMap.get(Number(r.id_cabang)) || m.nama_cabang; m.total_omset = Number(r.total_omset || 0) }
  for (const r of trxRows) { const m = ensure(r.id_cabang); m.num_trx = Number(r.num_trx || 0) }
  for (const r of custRows) { const m = ensure(r.id_cabang); m.num_customer = Number(r.num_customer || 0) }
  for (const r of kmRows) { const m = ensure(r.id_cabang); m.total_kacamata = Number(r.total_kacamata || 0) }
  for (const r of glRows) { const m = ensure(r.id_cabang); m.total_ganti_lensa = Number(r.total_ganti_lensa || 0) }
  for (const r of gfRows) { const m = ensure(r.id_cabang); m.total_ganti_frame = Number(r.total_ganti_frame || 0) }
  for (const r of slRows) { const m = ensure(r.id_cabang); m.total_softlens = Number(r.total_softlens || 0) }
  for (const r of ongkirRows) { const m = ensure(r.id_cabang); m.total_ongkir = Number(r.total_ongkir || 0) }
  for (const r of kmQtyRows) { const m = ensure(r.id_cabang); m.qty_kacamata = Number(r.qty_kacamata || 0) }
  for (const r of glQtyRows) { const m = ensure(r.id_cabang); m.qty_ganti_lensa = Number(r.qty_ganti_lensa || 0) }
  for (const r of gfQtyRows) { const m = ensure(r.id_cabang); m.qty_ganti_frame = Number(r.qty_ganti_frame || 0) }
  for (const r of slQtyRows) { const m = ensure(r.id_cabang); m.qty_softlens = Number(r.qty_softlens || 0) }

  const all = Array.from(map.values()).sort((a, b) => String(a.nama_cabang).localeCompare(String(b.nama_cabang)))
  const total = all.length
  const sliced = Number(limit) > 0 ? all.slice(offset, offset + Number(limit)) : all
  return { data: sliced, total }
}

export async function fetchOmsetTokoDay({ tanggal, cabangId, page = 1, limit = 50 }) {
  const tgl = tanggal
  if (!tgl) return { data: [], total: 0 }

  const paramsBase = [tgl]
  const paramsCabang = []
  if (cabangId) paramsCabang.push(cabangId)

  const [omsetRows] = await pool.query(
    `SELECT gp.id_cabang, ct.nama_cabang, SUM(IFNULL(gp.jumlah_bayar,0)) AS total_omset
     FROM grosir_pembayaran gp
       JOIN grosir g ON g.kode_grosir = gp.kode_grosir AND g.id_cabang = gp.id_cabang
       LEFT JOIN customer c ON c.kode_customer = g.kode_customer
       LEFT JOIN cabang_toko ct ON ct.id_cabang = gp.id_cabang
     WHERE DATE(gp.tanggal_bayar) = ?
       ${cabangId ? 'AND gp.id_cabang = ?' : ''}
       AND (c.status_user IS NULL OR LOWER(c.status_user) <> 'blacklist')
     GROUP BY gp.id_cabang, ct.nama_cabang
     ORDER BY ct.nama_cabang ASC`,
    [...paramsBase, ...paramsCabang]
  )

  const [trxRows] = await pool.query(
    `SELECT g.id_cabang, COUNT(*) AS num_trx
     FROM grosir g
     WHERE DATE(g.tanggal_grosir) = ?
       ${cabangId ? 'AND g.id_cabang = ?' : ''}
     GROUP BY g.id_cabang`,
    [...paramsBase, ...paramsCabang]
  )

  const [custRows] = await pool.query(
    `SELECT customer.cabang AS id_cabang, COUNT(*) AS num_customer
     FROM customer
     WHERE tanggal_daftar LIKE CONCAT(?, '%')
       ${cabangId ? 'AND customer.cabang = ?' : ''}
     GROUP BY customer.cabang`,
    [...paramsBase, ...paramsCabang]
  )

  const [kmRows] = await pool.query(
    `SELECT g.id_cabang, SUM(IFNULL(gp.jumlah_bayar,0)) AS total_kacamata
     FROM grosir_pembayaran gp
       JOIN grosir g ON g.kode_grosir = gp.kode_grosir
       LEFT JOIN customer c ON c.kode_customer = g.kode_customer
     WHERE DATE(gp.tanggal_bayar) = ? AND g.tipe_transaksi = 'kacamata'
       ${cabangId ? 'AND g.id_cabang = ?' : ''}
       AND (c.status_user IS NULL OR LOWER(c.status_user) <> 'blacklist')
     GROUP BY g.id_cabang`,
    [...paramsBase, ...paramsCabang]
  )

  const [glRows] = await pool.query(
    `SELECT g.id_cabang, SUM(IFNULL(gp.jumlah_bayar,0)) AS total_ganti_lensa
     FROM grosir_pembayaran gp
       JOIN grosir g ON g.kode_grosir = gp.kode_grosir
       LEFT JOIN customer c ON c.kode_customer = g.kode_customer
     WHERE DATE(gp.tanggal_bayar) = ? AND g.tipe_transaksi = 'ganti_lensa'
       ${cabangId ? 'AND g.id_cabang = ?' : ''}
       AND (c.status_user IS NULL OR LOWER(c.status_user) <> 'blacklist')
     GROUP BY g.id_cabang`,
    [...paramsBase, ...paramsCabang]
  )

  const [gfRows] = await pool.query(
    `SELECT g.id_cabang, SUM(IFNULL(gp.jumlah_bayar,0)) AS total_ganti_frame
     FROM grosir_pembayaran gp
       JOIN grosir g ON g.kode_grosir = gp.kode_grosir
       LEFT JOIN customer c ON c.kode_customer = g.kode_customer
     WHERE DATE(gp.tanggal_bayar) = ? AND g.tipe_transaksi = 'ganti_frame'
       ${cabangId ? 'AND g.id_cabang = ?' : ''}
       AND (c.status_user IS NULL OR LOWER(c.status_user) <> 'blacklist')
     GROUP BY g.id_cabang`,
    [...paramsBase, ...paramsCabang]
  )

  const [slRowsDay] = await pool.query(
    `SELECT gl.id_cabang, SUM(
        CASE WHEN gl.jumlah_harga = 0 THEN (gl.harga_produk * gl.jumlah)
             ELSE gl.jumlah_harga END
      ) AS total_softlens
     FROM grosir_log gl
       JOIN grosir g ON g.kode_grosir = gl.id_grosir
       LEFT JOIN customer c ON c.kode_customer = g.kode_customer
    WHERE DATE(gl.tanggal_log) = ? AND gl.jenis_produk = 'softlens'
      ${cabangId ? 'AND gl.id_cabang = ?' : ''}
      AND (c.status_user IS NULL OR LOWER(c.status_user) <> 'blacklist')
    GROUP BY gl.id_cabang`,
    [...paramsBase, ...paramsCabang]
  )

  const [ongkirRowsDay] = await pool.query(
    `SELECT gl.id_cabang, SUM(
        CASE gl.jenis_produk
          WHEN 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = gl.id_produk) * gl.jumlah
          WHEN 'lensa'    THEN (SELECT harga_ongkir FROM lensa    WHERE lensa.id_lensa = gl.id_produk) * gl.jumlah
          WHEN 'frame'    THEN (SELECT harga_ongkir FROM frame    WHERE frame.id_frame = gl.id_produk) * gl.jumlah
          WHEN 'katalog'  THEN (SELECT harga_ongkir FROM produk   WHERE produk.id_produk = gl.id_produk) * gl.jumlah
          ELSE 0
        END
      ) AS total_ongkir
     FROM grosir_log gl
       JOIN grosir g ON g.kode_grosir = gl.id_grosir
       LEFT JOIN customer c ON c.kode_customer = g.kode_customer
     WHERE DATE(gl.tanggal_log) = ?
       ${cabangId ? 'AND gl.id_cabang = ?' : ''}
       AND (c.status_user IS NULL OR LOWER(c.status_user) <> 'blacklist')
     GROUP BY gl.id_cabang`,
    [...paramsBase, ...paramsCabang]
  )

  const map = new Map()
  for (const r of omsetRows) {
    const key = Number(r.id_cabang)
    const cur = map.get(key) || { id_cabang: key, nama_cabang: '', total_omset: 0, total_ongkir: 0, num_trx: 0, num_customer: 0, total_kacamata: 0, total_ganti_lensa: 0, total_ganti_frame: 0, total_softlens: 0 }
    cur.id_cabang = key
    cur.nama_cabang = r.nama_cabang
    cur.total_omset = Number(r.total_omset || 0)
    map.set(key, cur)
  }
  for (const r of trxRows) {
    const key = Number(r.id_cabang)
    const cur = map.get(key) || { id_cabang: key, nama_cabang: '', total_omset: 0, num_trx: 0, num_customer: 0, total_kacamata: 0, total_ganti_lensa: 0, total_ganti_frame: 0, total_softlens: 0 }
    cur.num_trx = Number(r.num_trx || 0)
    map.set(key, cur)
  }
  for (const r of custRows) {
    const key = Number(r.id_cabang)
    const cur = map.get(key) || { id_cabang: key, nama_cabang: '', total_omset: 0, num_trx: 0, num_customer: 0, total_kacamata: 0, total_ganti_lensa: 0, total_ganti_frame: 0, total_softlens: 0 }
    cur.num_customer = Number(r.num_customer || 0)
    map.set(key, cur)
  }
  for (const r of kmRows) {
    const key = Number(r.id_cabang)
    const cur = map.get(key) || { id_cabang: key, nama_cabang: '', total_omset: 0, num_trx: 0, num_customer: 0, total_kacamata: 0, total_ganti_lensa: 0, total_ganti_frame: 0, total_softlens: 0 }
    cur.total_kacamata = Number(r.total_kacamata || 0)
    map.set(key, cur)
  }
  for (const r of glRows) {
    const key = Number(r.id_cabang)
    const cur = map.get(key) || { id_cabang: key, nama_cabang: '', total_omset: 0, num_trx: 0, num_customer: 0, total_kacamata: 0, total_ganti_lensa: 0, total_ganti_frame: 0, total_softlens: 0 }
    cur.total_ganti_lensa = Number(r.total_ganti_lensa || 0)
    map.set(key, cur)
  }
  for (const r of gfRows) {
    const key = Number(r.id_cabang)
    const cur = map.get(key) || { id_cabang: key, nama_cabang: '', total_omset: 0, num_trx: 0, num_customer: 0, total_kacamata: 0, total_ganti_lensa: 0, total_ganti_frame: 0, total_softlens: 0 }
    cur.total_ganti_frame = Number(r.total_ganti_frame || 0)
    map.set(key, cur)
  }
  for (const r of ongkirRowsDay) {
    const key = Number(r.id_cabang)
    const cur = map.get(key) || { id_cabang: key, nama_cabang: '', total_omset: 0, total_ongkir: 0, num_trx: 0, num_customer: 0, total_kacamata: 0, total_ganti_lensa: 0, total_ganti_frame: 0, total_softlens: 0 }
    cur.total_ongkir = Number(r.total_ongkir || 0)
    map.set(key, cur)
  }
  for (const r of slRowsDay) {
    const key = Number(r.id_cabang)
    const cur = map.get(key) || { id_cabang: key, nama_cabang: '', total_omset: 0, num_trx: 0, num_customer: 0, total_kacamata: 0, total_ganti_lensa: 0, total_ganti_frame: 0, total_softlens: 0 }
    cur.total_softlens = Number(r.total_softlens || 0)
    map.set(key, cur)
  }

  const all = Array.from(map.values()).sort((a, b) => String(a.nama_cabang).localeCompare(String(b.nama_cabang)))
  const total = all.length
  const offset = Math.max(0, (Number(page) - 1) * Number(limit))
  const sliced = Number(limit) > 0 ? all.slice(offset, offset + Number(limit)) : all
  return { data: sliced, total }
}

export async function fetchOmsetTokoDayItems({ tanggal, cabangId }) {
  if (!tanggal || !cabangId) return []
  const [rows] = await pool.query(
    `SELECT grosir_log.id_grosir,
            g.kode_grosir AS kode_transaksi,
            COALESCE(
              c.nama_customer,
              (SELECT customer.nama_customer
                 FROM transaksi t
                   LEFT JOIN customer ON customer.kode_customer = t.kode_customer
                WHERE t.kode_transaksi = g.kode_grosir
                LIMIT 1),
              (SELECT customer.nama_customer
                 FROM transaksi t
                   LEFT JOIN customer ON customer.kode_customer = t.kode_customer
                WHERE t.id_transaksi = g.kode_grosir
                LIMIT 1)
            ) AS nama_customer,
            c.status_user AS status_user,
            g.tipe_transaksi,
            grosir_log.jenis_produk, grosir_log.jumlah, grosir_log.id_produk,
            grosir_log.harga_produk, grosir_log.jumlah_harga, grosir_log.tanggal_log,
            cabang_toko.nama_cabang,
      CASE 
        WHEN grosir_log.jenis_produk = 'katalog' THEN (SELECT CONCAT(nama_produk, ' (', sku_katalog, ')') FROM produk WHERE produk.id_produk = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'softlens' THEN (SELECT CONCAT(nama_softlens, ' (', sku_softlens, ')') FROM softlens WHERE softlens.id_softlens = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'lensa' THEN (SELECT CONCAT(nama_lensa_kat, ' ', size, ' | ', sku_lensa) FROM (SELECT id_lensa, sku_lensa, nama_lensa_kat, size FROM lensa JOIN lensa_kat ON lensa_kat.id_lensa_kat=lensa.id_lensa_kat) lensa WHERE lensa.id_lensa = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'frame' THEN (SELECT CONCAT((SELECT nama_frame FROM frame_kat WHERE frame_kat.id_kat_frame = frame.id_kat_frame), ' (', sku_frame, ')') FROM frame WHERE frame.id_frame = grosir_log.id_produk)
        ELSE CONCAT('ID ', grosir_log.id_produk)
      END AS nama_produk,
      CASE 
        WHEN grosir_log.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = grosir_log.id_produk)
        ELSE 0
      END AS harga_modal,
      (CASE 
        WHEN grosir_log.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = grosir_log.id_produk)
        ELSE 0
      END) * grosir_log.jumlah AS jumlah_modal,
      CASE 
        WHEN grosir_log.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = grosir_log.id_produk)
        ELSE 0
      END AS harga_ongkir,
      (CASE 
        WHEN grosir_log.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = grosir_log.id_produk)
        ELSE 0
      END) * grosir_log.jumlah AS jumlah_ongkir,
      ((CASE 
        WHEN grosir_log.jumlah_harga = 0 THEN (grosir_log.harga_produk * grosir_log.jumlah)
        ELSE grosir_log.jumlah_harga
      END) - ((CASE 
        WHEN grosir_log.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = grosir_log.id_produk)
        ELSE 0
     END) * grosir_log.jumlah)
     - ((CASE 
        WHEN grosir_log.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = grosir_log.id_produk)
        ELSE 0
     END) * grosir_log.jumlah)) AS laba_item
     FROM grosir_log 
       LEFT JOIN cabang_toko ON cabang_toko.id_cabang = grosir_log.id_cabang
       LEFT JOIN grosir g ON g.kode_grosir = grosir_log.id_grosir
       LEFT JOIN customer c ON c.kode_customer = g.kode_customer
     WHERE DATE(grosir_log.tanggal_log) = ? AND grosir_log.id_cabang = ?
     ORDER BY grosir_log.id_sg_log DESC`,
    [tanggal, cabangId]
  )
  return rows
}

export async function fetchOmsetTokoItemsPeriod({ pembukuanId, cabangId }) {
  const active = await getActivePembukuan(pembukuanId)
  if (!active || !cabangId) return []
  const [rows] = await pool.query(
    `SELECT grosir_log.id_grosir,
            g.kode_grosir AS kode_transaksi,
            ) AS nama_customer,
            c.status_user AS status_user,
            g.tipe_transaksi,
            grosir_log.jenis_produk, grosir_log.jumlah, grosir_log.id_produk,
            grosir_log.harga_produk, grosir_log.jumlah_harga, grosir_log.tanggal_log,
            cabang_toko.nama_cabang,
      CASE 
        WHEN grosir_log.jenis_produk = 'katalog' THEN (SELECT CONCAT(nama_produk, ' (', sku_katalog, ')') FROM produk WHERE produk.id_produk = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'softlens' THEN (SELECT CONCAT(nama_softlens, ' (', sku_softlens, ')') FROM softlens WHERE softlens.id_softlens = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'lensa' THEN (SELECT CONCAT(nama_lensa_kat, ' ', size, ' | ', sku_lensa) FROM (SELECT id_lensa, sku_lensa, nama_lensa_kat, size FROM lensa JOIN lensa_kat ON lensa_kat.id_lensa_kat=lensa.id_lensa_kat) lensa WHERE lensa.id_lensa = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'frame' THEN (SELECT CONCAT((SELECT nama_frame FROM frame_kat WHERE frame_kat.id_kat_frame = frame.id_kat_frame), ' (', sku_frame, ')') FROM frame WHERE frame.id_frame = grosir_log.id_produk)
        ELSE CONCAT('ID ', grosir_log.id_produk)
      END AS nama_produk,
      CASE 
        WHEN grosir_log.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = grosir_log.id_produk)
        ELSE 0
      END AS harga_modal,
      (CASE 
        WHEN grosir_log.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = grosir_log.id_produk)
        ELSE 0
      END) * grosir_log.jumlah AS jumlah_modal,
      ((CASE 
        WHEN grosir_log.jumlah_harga = 0 THEN (grosir_log.harga_produk * grosir_log.jumlah)
        ELSE grosir_log.jumlah_harga
      END) - ((CASE 
        WHEN grosir_log.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = grosir_log.id_produk)
        ELSE 0
     END) * grosir_log.jumlah)
     - ((CASE 
        WHEN grosir_log.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = grosir_log.id_produk)
        WHEN grosir_log.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = grosir_log.id_produk)
        ELSE 0
     END) * grosir_log.jumlah)) AS laba_item
     FROM grosir_log 
       LEFT JOIN cabang_toko ON cabang_toko.id_cabang = grosir_log.id_cabang
       LEFT JOIN grosir g ON g.kode_grosir = grosir_log.id_grosir
       LEFT JOIN customer c ON c.kode_customer = g.kode_customer
     WHERE grosir_log.tanggal_log BETWEEN ? AND ? AND grosir_log.id_cabang = ?
     ORDER BY grosir_log.id_sg_log DESC`,
    [active.tanggal_buka_buku, active.tanggal_tutup_buku, cabangId]
  )
  return rows
}

export async function fetchCabangAnalysis({ pembukuanId, cabangId }) {
  const active = await getActivePembukuan(pembukuanId)
  if (!active || !cabangId) return { toko: {}, marketing: {}, biaya: 0, top_products: [], peak_hours: [] }

  const paramsPeriod = [active.tanggal_buka_buku, active.tanggal_tutup_buku]
  const paramsCabang = [cabangId]

  const [omsetRows] = await pool.query(
    `SELECT SUM(IFNULL(gp.jumlah_bayar,0)) AS total_omset
     FROM grosir_pembayaran gp
       JOIN grosir g ON g.kode_grosir = gp.kode_grosir AND g.id_cabang = gp.id_cabang
       LEFT JOIN customer c ON c.kode_customer = g.kode_customer
     WHERE gp.tanggal_bayar BETWEEN ? AND ? AND gp.id_cabang = ?
      ${await ensureCustomerStatusUserCol() ? "AND (c.status_user IS NULL OR LOWER(c.status_user) <> 'blacklist')" : ''}`,
    [...paramsPeriod, ...paramsCabang]
  )

  const [labaRows] = await pool.query(
    `SELECT SUM(
        (CASE WHEN grosir_log.jumlah_harga = 0 THEN (grosir_log.harga_produk * grosir_log.jumlah)
              ELSE grosir_log.jumlah_harga END)
        - (CASE 
            WHEN grosir_log.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = grosir_log.id_produk) * grosir_log.jumlah
            WHEN grosir_log.jenis_produk = 'lensa'    THEN (SELECT harga_modal FROM lensa    WHERE lensa.id_lensa = grosir_log.id_produk) * grosir_log.jumlah
            WHEN grosir_log.jenis_produk = 'frame'    THEN (SELECT harga_modal FROM frame    WHERE frame.id_frame = grosir_log.id_produk) * grosir_log.jumlah
            WHEN grosir_log.jenis_produk = 'katalog'  THEN (SELECT harga_modal FROM produk   WHERE produk.id_produk = grosir_log.id_produk) * grosir_log.jumlah
            ELSE 0 END)
        - (CASE 
            WHEN grosir_log.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = grosir_log.id_produk) * grosir_log.jumlah
            WHEN grosir_log.jenis_produk = 'lensa'    THEN (SELECT harga_ongkir FROM lensa    WHERE lensa.id_lensa = grosir_log.id_produk) * grosir_log.jumlah
            WHEN grosir_log.jenis_produk = 'frame'    THEN (SELECT harga_ongkir FROM frame    WHERE frame.id_frame = grosir_log.id_produk) * grosir_log.jumlah
            WHEN grosir_log.jenis_produk = 'katalog'  THEN (SELECT harga_ongkir FROM produk   WHERE produk.id_produk = grosir_log.id_produk) * grosir_log.jumlah
            ELSE 0 END)
      ) AS total_laba
     FROM grosir_log
     WHERE grosir_log.tanggal_log BETWEEN ? AND ? AND grosir_log.id_cabang = ?`,
    [...paramsPeriod, ...paramsCabang]
  )

  const [biayaRows] = await pool.query(
    `SELECT SUM(IFNULL(total_modal,0)) AS total_biaya
     FROM modal
     WHERE tanggal_modal BETWEEN ? AND ? AND id_cabang = ?`,
    [...paramsPeriod, ...paramsCabang]
  )

  const [topRows] = await pool.query(
    `SELECT grosir_log.jenis_produk, grosir_log.id_produk, SUM(grosir_log.jumlah) AS qty,
            CASE 
              WHEN grosir_log.jenis_produk = 'katalog' THEN (SELECT CONCAT(nama_produk, ' (', sku_katalog, ')') FROM produk WHERE produk.id_produk = grosir_log.id_produk)
              WHEN grosir_log.jenis_produk = 'softlens' THEN (SELECT CONCAT(nama_softlens, ' (', sku_softlens, ')') FROM softlens WHERE softlens.id_softlens = grosir_log.id_produk)
              WHEN grosir_log.jenis_produk = 'lensa' THEN (SELECT CONCAT(nama_lensa_kat, ' ', size, ' | ', sku_lensa) FROM (SELECT id_lensa, sku_lensa, nama_lensa_kat, size FROM lensa JOIN lensa_kat ON lensa_kat.id_lensa_kat=lensa.id_lensa_kat) lensa WHERE lensa.id_lensa = grosir_log.id_produk)
              WHEN grosir_log.jenis_produk = 'frame' THEN (SELECT CONCAT((SELECT nama_frame FROM frame_kat WHERE frame_kat.id_kat_frame = frame.id_kat_frame), ' (', sku_frame, ')') FROM frame WHERE frame.id_frame = grosir_log.id_produk)
              ELSE CONCAT('ID ', grosir_log.id_produk)
            END AS nama_produk
     FROM grosir_log
     WHERE grosir_log.tanggal_log BETWEEN ? AND ? AND grosir_log.id_cabang = ?
     GROUP BY grosir_log.jenis_produk, grosir_log.id_produk
     ORDER BY qty DESC
     LIMIT 10`,
    [...paramsPeriod, ...paramsCabang]
  )

  const [peakRows] = await pool.query(
    `SELECT COALESCE(HOUR(grosir.jam_log), HOUR(grosir.tanggal_grosir)) AS jam, COUNT(*) AS hits
     FROM grosir
     WHERE grosir.tanggal_grosir BETWEEN ? AND ? AND grosir.id_cabang = ?
     GROUP BY COALESCE(HOUR(grosir.jam_log), HOUR(grosir.tanggal_grosir))
     ORDER BY hits DESC`,
    [...paramsPeriod, ...paramsCabang]
  )

  const toko = { total_omset: Number(omsetRows?.[0]?.total_omset || 0), total_laba: Number(labaRows?.[0]?.total_laba || 0) }
  const marketingSums = (await fetchMarketingReports({ pembukuanId, cabangId, limit: 0, includeSums: true })).sums
  let blSum = 0
  if (await ensureCustomerStatusUserCol()) {
    const [blRows] = await pool.query(
      `SELECT SUM(
          (CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END)
          - IFNULL(tp.jml_bayar,0)
        ) AS sum_tagihan_blacklist
       FROM transaksi
         LEFT JOIN (
           SELECT kode_transaksi, SUM(jumlah_bayar + IFNULL(bayar_lain, 0) + IFNULL(potong_marketing, 0)) AS jml_bayar,
                  MAX(jenis_transaksi) AS jenis_transaksi,
                  MAX(tanggal_bayar) AS tanggal_bayar
           FROM transaksi_pembayaran
           WHERE tanggal_bayar BETWEEN ? AND ?
             AND jenis_transaksi NOT IN ('piutang')
           GROUP BY kode_transaksi
         ) tp ON tp.kode_transaksi = transaksi.kode_transaksi
         LEFT JOIN customer ON customer.kode_customer = transaksi.kode_customer
       WHERE transaksi.tanggal_order BETWEEN ? AND ? AND transaksi.id_cabang = ?
         AND LOWER(customer.status_user) = 'blacklist'
         AND ((CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) - IFNULL(tp.jml_bayar,0)) > 0`,
      [...paramsPeriod, ...paramsPeriod, ...paramsCabang]
    )
    blSum = Number(blRows?.[0]?.sum_tagihan_blacklist || 0)
  }
  const marketing = { ...marketingSums, sum_tagihan_blacklist: blSum }
  const biaya = Number(biayaRows?.[0]?.total_biaya || 0)
  return { toko, marketing, biaya, top_products: topRows, peak_hours: peakRows }
}

export async function fetchCabangAnalysisAll({ pembukuanId }) {
  const active = await getActivePembukuan(pembukuanId)
  if (!active) return []

  const paramsPeriod = [active.tanggal_buka_buku, active.tanggal_tutup_buku]
  const [cabangRows] = await pool.query(`SELECT id_cabang, nama_cabang FROM cabang_toko`)
  const cabangNameMap = new Map(cabangRows.map(r => [Number(r.id_cabang), r.nama_cabang]))

  const [marketingByCabang] = await pool.query(
    `SELECT transaksi.id_cabang, cabang_toko.nama_cabang,
            SUM((CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END)) AS sum_fix_harga,
            SUM(IFNULL(tp.jml_bayar,0)) AS sum_jml_bayar,
            SUM(COALESCE((CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) - IFNULL(it.sum_modal,0), 0)) AS sum_laba_items
     FROM transaksi
       LEFT JOIN (
         SELECT kode_transaksi, SUM(jumlah_bayar + IFNULL(bayar_lain, 0) + IFNULL(potong_marketing, 0)) AS jml_bayar,
                MAX(jenis_transaksi) AS jenis_transaksi,
                MAX(tanggal_bayar) AS tanggal_bayar
         FROM transaksi_pembayaran
         WHERE tanggal_bayar BETWEEN ? AND ?
           AND jenis_transaksi NOT IN ('piutang')
         GROUP BY kode_transaksi
       ) tp ON tp.kode_transaksi = transaksi.kode_transaksi
       LEFT JOIN (
         SELECT id_grosir,
                SUM(jumlah_harga) AS sum_jumlah_harga,
                SUM(
                  CASE jenis_produk
                    WHEN 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = transaksi_log.id_produk) * jumlah
                    WHEN 'lensa'    THEN (SELECT harga_modal FROM lensa    WHERE lensa.id_lensa = transaksi_log.id_produk) * jumlah
                    WHEN 'frame'    THEN (SELECT harga_modal FROM frame    WHERE frame.id_frame = transaksi_log.id_produk) * jumlah
                    WHEN 'katalog'  THEN (SELECT harga_modal FROM produk   WHERE produk.id_produk = transaksi_log.id_produk) * jumlah
                    ELSE 0
                  END
                ) AS sum_modal
         FROM transaksi_log
         WHERE transaksi_log.tanggal_log BETWEEN ? AND ?
         GROUP BY id_grosir
       ) it ON it.id_grosir = transaksi.kode_transaksi OR it.id_grosir = transaksi.id_transaksi
       LEFT JOIN cabang_toko ON cabang_toko.id_cabang = transaksi.id_cabang
     WHERE transaksi.tanggal_order BETWEEN ? AND ?
     GROUP BY transaksi.id_cabang, cabang_toko.nama_cabang`,
    [...paramsPeriod, ...paramsPeriod, ...paramsPeriod]
  )

  const [omsetTokoByCabang] = await pool.query(
    `SELECT gp.id_cabang, SUM(IFNULL(gp.jumlah_bayar,0)) AS total_omset
     FROM grosir_pembayaran gp
     WHERE gp.tanggal_bayar BETWEEN ? AND ?
     GROUP BY gp.id_cabang`,
    paramsPeriod
  )

  const [labaTokoByCabang] = await pool.query(
    `SELECT grosir_log.id_cabang, SUM(
        (CASE WHEN grosir_log.jumlah_harga = 0 THEN (grosir_log.harga_produk * grosir_log.jumlah)
              ELSE grosir_log.jumlah_harga END)
        - (CASE 
            WHEN grosir_log.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = grosir_log.id_produk) * grosir_log.jumlah
            WHEN grosir_log.jenis_produk = 'lensa'    THEN (SELECT harga_modal FROM lensa    WHERE lensa.id_lensa = grosir_log.id_produk) * grosir_log.jumlah
            WHEN grosir_log.jenis_produk = 'frame'    THEN (SELECT harga_modal FROM frame    WHERE frame.id_frame = grosir_log.id_produk) * grosir_log.jumlah
            WHEN grosir_log.jenis_produk = 'katalog'  THEN (SELECT harga_modal FROM produk   WHERE produk.id_produk = grosir_log.id_produk) * grosir_log.jumlah
            ELSE 0 END)
        - (CASE 
            WHEN grosir_log.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = grosir_log.id_produk) * grosir_log.jumlah
            WHEN grosir_log.jenis_produk = 'lensa'    THEN (SELECT harga_ongkir FROM lensa    WHERE lensa.id_lensa = grosir_log.id_produk) * grosir_log.jumlah
            WHEN grosir_log.jenis_produk = 'frame'    THEN (SELECT harga_ongkir FROM frame    WHERE frame.id_frame = grosir_log.id_produk) * grosir_log.jumlah
            WHEN grosir_log.jenis_produk = 'katalog'  THEN (SELECT harga_ongkir FROM produk   WHERE produk.id_produk = grosir_log.id_produk) * grosir_log.jumlah
            ELSE 0 END)
      ) AS total_laba
     FROM grosir_log
     WHERE grosir_log.tanggal_log BETWEEN ? AND ?
     GROUP BY grosir_log.id_cabang`,
    paramsPeriod
  )

  const [qtyByCabang] = await pool.query(
    `SELECT g.id_cabang,
            SUM(CASE WHEN g.tipe_transaksi = 'kacamata'    THEN gl.jumlah ELSE 0 END) AS qty_kacamata,
            SUM(CASE WHEN g.tipe_transaksi = 'ganti_lensa' THEN gl.jumlah ELSE 0 END) AS qty_gl,
            SUM(CASE WHEN g.tipe_transaksi = 'ganti_frame' THEN gl.jumlah ELSE 0 END) AS qty_frame,
            SUM(CASE WHEN gl.jenis_produk = 'softlens'     THEN gl.jumlah ELSE 0 END) AS qty_softlens
     FROM grosir_log gl
       JOIN grosir g ON g.kode_grosir = gl.id_grosir
     WHERE gl.tanggal_log BETWEEN ? AND ?
     GROUP BY g.id_cabang`,
    paramsPeriod
  )

  const mMap = new Map()
  for (const r of marketingByCabang) { mMap.set(Number(r.id_cabang), r) }
  const tMap = new Map()
  for (const r of omsetTokoByCabang) { tMap.set(Number(r.id_cabang), r) }
  const lMap = new Map()
  for (const r of labaTokoByCabang) { lMap.set(Number(r.id_cabang), r) }
  const qMap = new Map()
  for (const r of qtyByCabang) { qMap.set(Number(r.id_cabang), r) }

  const ids = new Set([...mMap.keys(), ...tMap.keys(), ...lMap.keys(), ...qMap.keys()])
  const result = []
  for (const id of ids) {
    const m = mMap.get(id) || {}
    const t = tMap.get(id) || {}
    const l = lMap.get(id) || {}
    const q = qMap.get(id) || {}
    const nama = m?.nama_cabang || cabangNameMap.get(Number(id)) || String(id)
    const omset_marketing = Number(m?.sum_fix_harga || 0)
    const bayar_marketing = Number(m?.sum_jml_bayar || 0)
    const laba_marketing = Number(m?.sum_laba_items || 0)
    const omset_toko = Number(t?.total_omset || 0)
    const laba_toko = Number(l?.total_laba || 0)
    const persen_bayar_marketing = omset_marketing > 0 ? (bayar_marketing / omset_marketing) * 100 : 0
    result.push({
      id_cabang: id, nama_cabang: nama, omset_marketing, omset_toko, laba_marketing, laba_toko, persen_bayar_marketing,
      qty_kacamata: Number(q?.qty_kacamata || 0), qty_gl: Number(q?.qty_gl || 0), qty_frame: Number(q?.qty_frame || 0), qty_softlens: Number(q?.qty_softlens || 0)
    })
  }
  result.sort((a, b) => (b.omset_marketing + b.omset_toko) - (a.omset_marketing + a.omset_toko))
  return result
}

// moved to profitLossService.js

export async function fetchMarketingItems(kode) {
  const [rows] = await pool.query(
    `SELECT * FROM (
       SELECT transaksi_log.id_sg_log AS sort_id,
              transaksi_log.id_grosir, transaksi_log.jenis_produk, transaksi_log.jumlah, transaksi_log.id_produk,
              transaksi_log.harga_produk, transaksi_log.jumlah_harga, transaksi_log.tanggal_log,
              cabang_toko.nama_cabang,
              CASE 
                WHEN transaksi_log.jenis_produk = 'katalog' THEN (SELECT CONCAT(nama_produk, ' (', sku_katalog, ')') FROM produk WHERE produk.id_produk = transaksi_log.id_produk)
                WHEN transaksi_log.jenis_produk = 'softlens' THEN (SELECT CONCAT(nama_softlens, ' (', sku_softlens, ')') FROM softlens WHERE softlens.id_softlens = transaksi_log.id_produk)
                WHEN transaksi_log.jenis_produk = 'lensa' THEN (SELECT CONCAT(nama_lensa_kat, ' ', size, ' | ', sku_lensa) FROM (SELECT id_lensa, sku_lensa, nama_lensa_kat, size FROM lensa JOIN lensa_kat ON lensa_kat.id_lensa_kat=lensa.id_lensa_kat) lensa WHERE lensa.id_lensa = transaksi_log.id_produk)
                WHEN transaksi_log.jenis_produk = 'frame' THEN (SELECT CONCAT((SELECT nama_frame FROM frame_kat WHERE frame_kat.id_kat_frame = frame.id_kat_frame), ' (', sku_frame, ')') FROM frame WHERE frame.id_frame = transaksi_log.id_produk)
                ELSE CONCAT('ID ', transaksi_log.id_produk)
              END AS nama_produk,
              CASE 
                WHEN transaksi_log.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = transaksi_log.id_produk)
                WHEN transaksi_log.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = transaksi_log.id_produk)
                WHEN transaksi_log.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = transaksi_log.id_produk)
                WHEN transaksi_log.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = transaksi_log.id_produk)
                ELSE 0
              END AS harga_modal,
              (CASE 
                WHEN transaksi_log.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = transaksi_log.id_produk)
                WHEN transaksi_log.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = transaksi_log.id_produk)
                WHEN transaksi_log.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = transaksi_log.id_produk)
                WHEN transaksi_log.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = transaksi_log.id_produk)
                ELSE 0
              END) * transaksi_log.jumlah AS jumlah_modal,
              CASE 
                WHEN transaksi_log.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = transaksi_log.id_produk)
                WHEN transaksi_log.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = transaksi_log.id_produk)
                WHEN transaksi_log.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = transaksi_log.id_produk)
                WHEN transaksi_log.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = transaksi_log.id_produk)
                ELSE 0
              END AS harga_ongkir,
              (CASE 
                WHEN transaksi_log.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = transaksi_log.id_produk)
                WHEN transaksi_log.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = transaksi_log.id_produk)
                WHEN transaksi_log.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = transaksi_log.id_produk)
                WHEN transaksi_log.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = transaksi_log.id_produk)
                ELSE 0
              END) * transaksi_log.jumlah AS jumlah_ongkir,
              ((CASE WHEN transaksi_log.jumlah_harga = 0 THEN (transaksi_log.harga_produk * transaksi_log.jumlah) ELSE transaksi_log.jumlah_harga END)
               - ((CASE 
                   WHEN transaksi_log.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = transaksi_log.id_produk)
                   WHEN transaksi_log.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = transaksi_log.id_produk)
                   WHEN transaksi_log.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = transaksi_log.id_produk)
                   WHEN transaksi_log.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = transaksi_log.id_produk)
                   ELSE 0
                 END) * transaksi_log.jumlah)
               - ((CASE 
                   WHEN transaksi_log.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = transaksi_log.id_produk)
                   WHEN transaksi_log.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = transaksi_log.id_produk)
                   WHEN transaksi_log.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = transaksi_log.id_produk)
                   WHEN transaksi_log.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = transaksi_log.id_produk)
                   ELSE 0
                 END) * transaksi_log.jumlah)) AS laba_item
       FROM transaksi_log 
         LEFT JOIN cabang_toko ON cabang_toko.id_cabang = transaksi_log.id_cabang
       WHERE transaksi_log.id_grosir = ?
          OR transaksi_log.id_grosir = (SELECT id_transaksi FROM transaksi WHERE kode_transaksi = ?)
       UNION ALL
       SELECT gl.id_sg_log AS sort_id,
              gl.id_grosir, gl.jenis_produk, gl.jumlah, gl.id_produk,
              gl.harga_produk, gl.jumlah_harga, gl.tanggal_log,
              cabang_toko.nama_cabang,
              CASE 
                WHEN gl.jenis_produk = 'katalog' THEN (SELECT CONCAT(nama_produk, ' (', sku_katalog, ')') FROM produk WHERE produk.id_produk = gl.id_produk)
                WHEN gl.jenis_produk = 'softlens' THEN (SELECT CONCAT(nama_softlens, ' (', sku_softlens, ')') FROM softlens WHERE softlens.id_softlens = gl.id_produk)
                WHEN gl.jenis_produk = 'lensa' THEN (SELECT CONCAT(nama_lensa_kat, ' ', size, ' | ', sku_lensa) FROM (SELECT id_lensa, sku_lensa, nama_lensa_kat, size FROM lensa JOIN lensa_kat ON lensa_kat.id_lensa_kat=lensa.id_lensa_kat) lensa WHERE lensa.id_lensa = gl.id_produk)
                WHEN gl.jenis_produk = 'frame' THEN (SELECT CONCAT((SELECT nama_frame FROM frame_kat WHERE frame_kat.id_kat_frame = frame.id_kat_frame), ' (', sku_frame, ')') FROM frame WHERE frame.id_frame = gl.id_produk)
                ELSE CONCAT('ID ', gl.id_produk)
              END AS nama_produk,
              CASE 
                WHEN gl.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = gl.id_produk)
                WHEN gl.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = gl.id_produk)
                WHEN gl.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = gl.id_produk)
                WHEN gl.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = gl.id_produk)
                ELSE 0
              END AS harga_modal,
              (CASE 
                WHEN gl.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = gl.id_produk)
                WHEN gl.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = gl.id_produk)
                WHEN gl.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = gl.id_produk)
                WHEN gl.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = gl.id_produk)
                ELSE 0
              END) * gl.jumlah AS jumlah_modal,
              CASE 
                WHEN gl.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = gl.id_produk)
                WHEN gl.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = gl.id_produk)
                WHEN gl.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = gl.id_produk)
                WHEN gl.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = gl.id_produk)
                ELSE 0
              END AS harga_ongkir,
              (CASE 
                WHEN gl.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = gl.id_produk)
                WHEN gl.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = gl.id_produk)
                WHEN gl.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = gl.id_produk)
                WHEN gl.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = gl.id_produk)
                ELSE 0
              END) * gl.jumlah AS jumlah_ongkir,
              ((CASE WHEN gl.jumlah_harga = 0 THEN (gl.harga_produk * gl.jumlah) ELSE gl.jumlah_harga END)
               - ((CASE 
                   WHEN gl.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = gl.id_produk)
                   WHEN gl.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = gl.id_produk)
                   WHEN gl.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = gl.id_produk)
                   WHEN gl.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = gl.id_produk)
                   ELSE 0
                 END) * gl.jumlah)
               - ((CASE 
                   WHEN gl.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = gl.id_produk)
                   WHEN gl.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = gl.id_produk)
                   WHEN gl.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = gl.id_produk)
                   WHEN gl.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = gl.id_produk)
                   ELSE 0
                 END) * gl.jumlah)) AS laba_item
       FROM grosir_log gl
         LEFT JOIN grosir g ON g.kode_grosir = gl.id_grosir
         LEFT JOIN cabang_toko ON cabang_toko.id_cabang = g.id_cabang
       WHERE gl.id_grosir = ?
     ) u
     ORDER BY u.sort_id DESC`,
    [kode, kode, kode]
  )
  return rows
}

export async function fetchMarketingTransactionHeader(kode) {
  const [rows] = await pool.query(
    `SELECT 
        t.id_transaksi,
        t.kode_transaksi,
        t.tanggal_order,
        admin.nama_lengkap AS nama_marketing,
        cabang_toko.nama_cabang,
        c.nama_customer,
        c.kode_customer,
        (CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) AS fix_harga,
        (
          SELECT SUM(IFNULL(jumlah_bayar,0))
          FROM transaksi_pembayaran pSum
          WHERE pSum.kode_transaksi = t.kode_transaksi
            AND (pSum.jenis_transaksi IS NULL OR UPPER(pSum.jenis_transaksi) <> 'PIUTANG')
        ) AS jml_bayar,
        (
          SELECT SUM(IFNULL(voucher_use,0))
          FROM sponsor_voucher_use vSum
          WHERE vSum.kode_transaksi = t.kode_transaksi
        ) AS total_voucher,
        (
          (CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) -
          IFNULL((
            SELECT SUM(IFNULL(jumlah_bayar,0))
            FROM transaksi_pembayaran pSum2
            WHERE pSum2.kode_transaksi = t.kode_transaksi
              AND (pSum2.jenis_transaksi IS NULL OR UPPER(pSum2.jenis_transaksi) <> 'PIUTANG')
          ),0) -
          IFNULL((
            SELECT SUM(IFNULL(voucher_use,0))
            FROM sponsor_voucher_use vSum2
            WHERE vSum2.kode_transaksi = t.kode_transaksi
          ),0)
        ) AS sisa_bayar,
        (
          SELECT MAX(tanggal_bayar)
          FROM transaksi_pembayaran pMax
          WHERE pMax.kode_transaksi = t.kode_transaksi
        ) AS last_bayar,
        (
          SELECT MAX(jenis_transaksi)
          FROM transaksi_pembayaran pMax2
          WHERE pMax2.kode_transaksi = t.kode_transaksi
        ) AS jenis_transaksi_bayar
     FROM transaksi t
       LEFT JOIN admin ON admin.id = t.id_marketing
       LEFT JOIN cabang_toko ON cabang_toko.id_cabang = t.id_cabang
       LEFT JOIN customer c ON c.kode_customer = t.kode_customer
     WHERE t.kode_transaksi = ?
     LIMIT 1`,
    [kode]
  )
  const r = rows?.[0] || null
  if (r) {
    return {
      ...r,
      fix_harga: Number(r.fix_harga || 0),
      jml_bayar: Number(r.jml_bayar || 0),
      sisa_bayar: Number(r.sisa_bayar || 0)
    }
  }
  const [rowsG] = await pool.query(
    `SELECT 
        g.kode_grosir AS kode_transaksi,
        g.tanggal_grosir AS tanggal_order,
        NULL AS nama_marketing,
        cabang_toko.nama_cabang,
        c.nama_customer,
        c.kode_customer,
        IFNULL(gl.sum_jumlah_harga,0) AS fix_harga,
        IFNULL(gp.jml_bayar,0) AS jml_bayar,
        (IFNULL(gl.sum_jumlah_harga,0) - IFNULL(gp.jml_bayar,0)) AS sisa_bayar,
        (
          SELECT MAX(tanggal_bayar)
          FROM grosir_pembayaran pMax
          WHERE pMax.kode_grosir = g.kode_grosir AND pMax.id_cabang = g.id_cabang
        ) AS last_bayar,
        NULL AS jenis_transaksi_bayar
     FROM grosir g
       LEFT JOIN cabang_toko ON cabang_toko.id_cabang = g.id_cabang
       LEFT JOIN customer c ON c.kode_customer = g.kode_customer
       LEFT JOIN (
         SELECT id_grosir,
                SUM(jumlah_harga) AS sum_jumlah_harga
         FROM grosir_log
         WHERE id_grosir = ?
         GROUP BY id_grosir
       ) gl ON gl.id_grosir = g.kode_grosir
      LEFT JOIN (
        SELECT id_cabang, kode_grosir,
               SUM(IFNULL(jumlah_bayar,0) + IFNULL(bayar_bpjs,0) + IFNULL(bayar_lain,0)) AS jml_bayar
        FROM grosir_pembayaran
        WHERE kode_grosir = ?
        GROUP BY id_cabang, kode_grosir
      ) gp ON gp.kode_grosir = g.kode_grosir AND gp.id_cabang = g.id_cabang
     WHERE g.kode_grosir = ?
     LIMIT 1`,
    [kode, kode, kode]
  )
  const g = rowsG?.[0] || null
  return g ? {
    ...g,
    fix_harga: Number(g.fix_harga || 0),
    jml_bayar: Number(g.jml_bayar || 0),
    sisa_bayar: Number(g.sisa_bayar || 0)
  } : null
}

export async function fetchMarketingProductDistribution({ marketingId, cabangId, pembukuanId }) {
  const active = Number.isInteger(pembukuanId) ? await getActivePembukuan(pembukuanId) : null
  const params = []
  let where = 'WHERE 1=1'
  if (marketingId) { where += ' AND t.id_marketing = ?'; params.push(marketingId) }
  if (cabangId) { where += ' AND t.id_cabang = ?'; params.push(cabangId) }
  if (active) { where += ' AND t.tanggal_order BETWEEN ? AND ?'; params.push(active.tanggal_buka_buku, active.tanggal_tutup_buku) }
  const [rows] = await pool.query(
    `SELECT
        SUM(CASE WHEN gl.jenis_sub_trx = 'kacamata' THEN 1 ELSE 0 END) AS qty_kacamata,
        SUM(CASE WHEN gl.jenis_sub_trx = 'ganti_lensa' THEN 1 ELSE 0 END) AS qty_ganti_lensa,
        SUM(CASE WHEN (gl.jenis_produk = 'frame' AND (gl.jenis_sub_trx IS NULL OR gl.jenis_sub_trx = '' OR gl.jenis_sub_trx = 'frame')) THEN 1 ELSE 0 END) AS qty_frame,
        SUM(CASE WHEN (gl.jenis_produk = 'lensa' AND (gl.jenis_sub_trx IS NULL OR gl.jenis_sub_trx = '')) THEN 1 ELSE 0 END) AS qty_lensa
     FROM grosir_log gl
       LEFT JOIN grosir g ON g.kode_grosir = gl.id_grosir
       LEFT JOIN transaksi t ON t.kode_transaksi = g.kode_grosir OR t.id_transaksi = g.kode_grosir
     ${where}`,
    params
  )
  const r = rows?.[0] || {}
  return {
    qty_kacamata: Number(r.qty_kacamata || 0),
    qty_ganti_lensa: Number(r.qty_ganti_lensa || 0),
    qty_frame: Number(r.qty_frame || 0),
    qty_lensa: Number(r.qty_lensa || 0)
  }
}

export async function fetchMarketingCustomerCompleteness({ marketingId, pembukuanId }) {
  const active = Number.isInteger(pembukuanId) ? await getActivePembukuan(pembukuanId) : null
  const [rows] = await pool.query({
    sql: `SELECT COUNT(*) AS total,
            SUM(IF(COALESCE(no_hp,'') <> '',1,0)) AS no_hp_ok,
            SUM(IF(COALESCE(alamat_lengkap,'') <> '',1,0)) AS alamat_ok,
            SUM(IF(COALESCE(file_ktp,'') <> '',1,0)) AS ktp_ok,
            SUM(IF(COALESCE(file_kk,'') <> '',1,0)) AS kk_ok
     FROM (
       SELECT c.kode_customer, c.no_hp, c.alamat_lengkap, c.file_ktp, c.file_kk
       FROM transaksi t
         LEFT JOIN customer c ON c.kode_customer = t.kode_customer
       WHERE t.id_marketing = ?
         ${active ? ' AND t.tanggal_order BETWEEN ? AND ?' : ''}
       GROUP BY c.kode_customer
     ) s`,
    timeout: 60000
  }, active ? [marketingId, active.tanggal_buka_buku, active.tanggal_tutup_buku] : [marketingId])
  const r = rows?.[0] || {}
  const total = Number(r.total || 0)
  const ok = Number(r.no_hp_ok || 0) + Number(r.alamat_ok || 0) + Number(r.ktp_ok || 0) + Number(r.kk_ok || 0)
  const percent = total > 0 ? (ok / (total * 4)) * 100 : 0
  return {
    percent,
    missing: {
      no_hp: Math.max(0, total - Number(r.no_hp_ok || 0)),
      alamat_lengkap: Math.max(0, total - Number(r.alamat_ok || 0)),
      file_ktp_url: Math.max(0, total - Number(r.ktp_ok || 0)),
      file_kk_url: Math.max(0, total - Number(r.kk_ok || 0)),
    }
  }
}

export async function fetchMarketingProductItems({ marketingId, pembukuanId }) {
  const active = Number.isInteger(pembukuanId) ? await getActivePembukuan(pembukuanId) : null
  const params = []
  let where = 'WHERE 1=1'
  if (marketingId) { where += ' AND t.id_marketing = ?'; params.push(marketingId) }
  if (active) { where += ' AND t.tanggal_order BETWEEN ? AND ?'; params.push(active.tanggal_buka_buku, active.tanggal_tutup_buku) }
  const [rows] = await pool.query({
    sql: `SELECT
        t.kode_transaksi,
        c.nama_customer,
        admin.nama_lengkap,
        tl.jenis_produk,
        NULL AS jenis_sub_trx,
        tl.jumlah,
        tl.id_produk,
        tl.harga_produk,
        tl.jumlah_harga,
        tl.tanggal_log,
        CASE 
          WHEN tl.jenis_produk = 'katalog' THEN (SELECT CONCAT(nama_produk, ' (', sku_katalog, ')') FROM produk WHERE produk.id_produk = tl.id_produk)
          WHEN tl.jenis_produk = 'softlens' THEN (SELECT CONCAT(nama_softlens, ' (', sku_softlens, ')') FROM softlens WHERE softlens.id_softlens = tl.id_produk)
          WHEN tl.jenis_produk = 'lensa' THEN (SELECT CONCAT(nama_lensa_kat, ' ', size, ' | ', sku_lensa) FROM (SELECT id_lensa, sku_lensa, nama_lensa_kat, size FROM lensa JOIN lensa_kat ON lensa_kat.id_lensa_kat=lensa.id_lensa_kat) lensa WHERE lensa.id_lensa = tl.id_produk)
          WHEN tl.jenis_produk = 'frame' THEN (SELECT CONCAT((SELECT nama_frame FROM frame_kat WHERE frame_kat.id_kat_frame = frame.id_kat_frame), ' (', sku_frame, ')') FROM frame WHERE frame.id_frame = tl.id_produk)
          ELSE CONCAT('ID ', tl.id_produk)
        END AS nama_produk,
        CASE 
          WHEN tl.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = tl.id_produk)
          WHEN tl.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = tl.id_produk)
          WHEN tl.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = tl.id_produk)
          WHEN tl.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = tl.id_produk)
          ELSE 0
        END AS harga_modal,
        (CASE 
          WHEN tl.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = tl.id_produk)
          WHEN tl.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = tl.id_produk)
          WHEN tl.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = tl.id_produk)
          WHEN tl.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = tl.id_produk)
          ELSE 0
        END) * tl.jumlah AS jumlah_modal,
        CASE 
          WHEN tl.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = tl.id_produk)
          WHEN tl.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = tl.id_produk)
          WHEN tl.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = tl.id_produk)
          WHEN tl.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = tl.id_produk)
          ELSE 0
        END AS harga_ongkir,
        (CASE 
          WHEN tl.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = tl.id_produk)
          WHEN tl.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = tl.id_produk)
          WHEN tl.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = tl.id_produk)
          WHEN tl.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = tl.id_produk)
          ELSE 0
        END) * tl.jumlah AS jumlah_ongkir,
        ((CASE 
          WHEN tl.jumlah_harga = 0 THEN (tl.harga_produk * tl.jumlah)
          ELSE tl.jumlah_harga
        END) - ((CASE 
          WHEN tl.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = tl.id_produk)
          WHEN tl.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = tl.id_produk)
          WHEN tl.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = tl.id_produk)
          WHEN tl.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = tl.id_produk)
          ELSE 0
        END) * tl.jumlah)
        - ((CASE 
          WHEN tl.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = tl.id_produk)
          WHEN tl.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = tl.id_produk)
          WHEN tl.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = tl.id_produk)
          WHEN tl.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = tl.id_produk)
          ELSE 0
        END) * tl.jumlah)) AS laba_item
     FROM transaksi_log tl
       LEFT JOIN transaksi t ON (t.id_transaksi = tl.id_grosir OR t.kode_transaksi = tl.id_grosir)
       LEFT JOIN customer c ON c.kode_customer = t.kode_customer
       LEFT JOIN admin ON admin.id = t.id_marketing
     ${where}
      ORDER BY tl.id_sg_log DESC`,
    timeout: 60000
  }, params)
  return rows
}

export async function fetchMarketingProductItemsBatch({ marketingId, pembukuanId, limit = 2000, maxBatches = 10 }) {
  const active = Number.isInteger(pembukuanId) ? await getActivePembukuan(pembukuanId) : null
  const paramsBase = []
  let where = 'WHERE 1=1'
  if (marketingId) { where += ' AND t.id_marketing = ?'; paramsBase.push(marketingId) }
  if (active) { where += ' AND t.tanggal_order BETWEEN ? AND ?'; paramsBase.push(active.tanggal_buka_buku, active.tanggal_tutup_buku) }
  const sql = `SELECT
        t.kode_transaksi,
        c.nama_customer,
        admin.nama_lengkap,
        tl.jenis_produk,
        NULL AS jenis_sub_trx,
        tl.jumlah,
        tl.id_produk,
        tl.harga_produk,
        tl.jumlah_harga,
        tl.tanggal_log,
        tl.id_sg_log,
        CASE 
          WHEN tl.jenis_produk = 'katalog' THEN (SELECT CONCAT(nama_produk, ' (', sku_katalog, ')') FROM produk WHERE produk.id_produk = tl.id_produk)
          WHEN tl.jenis_produk = 'softlens' THEN (SELECT CONCAT(nama_softlens, ' (', sku_softlens, ')') FROM softlens WHERE softlens.id_softlens = tl.id_produk)
          WHEN tl.jenis_produk = 'lensa' THEN (SELECT CONCAT(nama_lensa_kat, ' ', size, ' | ', sku_lensa) FROM (SELECT id_lensa, sku_lensa, nama_lensa_kat, size FROM lensa JOIN lensa_kat ON lensa_kat.id_lensa_kat=lensa.id_lensa_kat) lensa WHERE lensa.id_lensa = tl.id_produk)
          WHEN tl.jenis_produk = 'frame' THEN (SELECT CONCAT((SELECT nama_frame FROM frame_kat WHERE frame_kat.id_kat_frame = frame.id_kat_frame), ' (', sku_frame, ')') FROM frame WHERE frame.id_frame = tl.id_produk)
          ELSE CONCAT('ID ', tl.id_produk)
        END AS nama_produk,
        CASE 
          WHEN tl.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = tl.id_produk)
          WHEN tl.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = tl.id_produk)
          WHEN tl.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = tl.id_produk)
          WHEN tl.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = tl.id_produk)
          ELSE 0
        END AS harga_modal,
        (CASE 
          WHEN tl.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = tl.id_produk)
          WHEN tl.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = tl.id_produk)
          WHEN tl.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = tl.id_produk)
          WHEN tl.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = tl.id_produk)
          ELSE 0
        END) * tl.jumlah AS jumlah_modal,
        CASE 
          WHEN tl.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = tl.id_produk)
          WHEN tl.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = tl.id_produk)
          WHEN tl.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = tl.id_produk)
          WHEN tl.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = tl.id_produk)
          ELSE 0
        END AS harga_ongkir,
        (CASE 
          WHEN tl.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = tl.id_produk)
          WHEN tl.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = tl.id_produk)
          WHEN tl.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = tl.id_produk)
          WHEN tl.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = tl.id_produk)
          ELSE 0
        END) * tl.jumlah AS jumlah_ongkir,
        ((CASE 
          WHEN tl.jumlah_harga = 0 THEN (tl.harga_produk * tl.jumlah)
          ELSE tl.jumlah_harga
        END) - ((CASE 
          WHEN tl.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = tl.id_produk)
          WHEN tl.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = tl.id_produk)
          WHEN tl.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = tl.id_produk)
          WHEN tl.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = tl.id_produk)
          ELSE 0
        END) * tl.jumlah)
        - ((CASE 
          WHEN tl.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = tl.id_produk)
          WHEN tl.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = tl.id_produk)
          WHEN tl.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = tl.id_produk)
          WHEN tl.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = tl.id_produk)
          ELSE 0
        END) * tl.jumlah)) AS laba_item
      FROM transaksi_log tl
        LEFT JOIN transaksi t ON t.id_transaksi = tl.id_grosir
        LEFT JOIN customer c ON c.kode_customer = t.kode_customer
        LEFT JOIN admin ON admin.id = t.id_marketing
      ${where}
      UNION ALL
      SELECT
        t.kode_transaksi,
        c.nama_customer,
        admin.nama_lengkap,
        tl.jenis_produk,
        NULL AS jenis_sub_trx,
        tl.jumlah,
        tl.id_produk,
        tl.harga_produk,
        tl.jumlah_harga,
        tl.tanggal_log,
        tl.id_sg_log,
        CASE 
          WHEN tl.jenis_produk = 'katalog' THEN (SELECT CONCAT(nama_produk, ' (', sku_katalog, ')') FROM produk WHERE produk.id_produk = tl.id_produk)
          WHEN tl.jenis_produk = 'softlens' THEN (SELECT CONCAT(nama_softlens, ' (', sku_softlens, ')') FROM softlens WHERE softlens.id_softlens = tl.id_produk)
          WHEN tl.jenis_produk = 'lensa' THEN (SELECT CONCAT(nama_lensa_kat, ' ', size, ' | ', sku_lensa) FROM (SELECT id_lensa, sku_lensa, nama_lensa_kat, size FROM lensa JOIN lensa_kat ON lensa_kat.id_lensa_kat=lensa.id_lensa_kat) lensa WHERE lensa.id_lensa = tl.id_produk)
          WHEN tl.jenis_produk = 'frame' THEN (SELECT CONCAT((SELECT nama_frame FROM frame_kat WHERE frame_kat.id_kat_frame = frame.id_kat_frame), ' (', sku_frame, ')') FROM frame WHERE frame.id_frame = tl.id_produk)
          ELSE CONCAT('ID ', tl.id_produk)
        END AS nama_produk,
        CASE 
          WHEN tl.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = tl.id_produk)
          WHEN tl.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = tl.id_produk)
          WHEN tl.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = tl.id_produk)
          WHEN tl.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = tl.id_produk)
          ELSE 0
        END AS harga_modal,
        (CASE 
          WHEN tl.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = tl.id_produk)
          WHEN tl.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = tl.id_produk)
          WHEN tl.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = tl.id_produk)
          WHEN tl.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = tl.id_produk)
          ELSE 0
        END) * tl.jumlah AS jumlah_modal,
        CASE 
          WHEN tl.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = tl.id_produk)
          WHEN tl.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = tl.id_produk)
          WHEN tl.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = tl.id_produk)
          WHEN tl.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = tl.id_produk)
          ELSE 0
        END AS harga_ongkir,
        (CASE 
          WHEN tl.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = tl.id_produk)
          WHEN tl.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = tl.id_produk)
          WHEN tl.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = tl.id_produk)
          WHEN tl.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = tl.id_produk)
          ELSE 0
        END) * tl.jumlah AS jumlah_ongkir,
        ((CASE 
          WHEN tl.jumlah_harga = 0 THEN (tl.harga_produk * tl.jumlah)
          ELSE tl.jumlah_harga
        END) - ((CASE 
          WHEN tl.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = tl.id_produk)
          WHEN tl.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = tl.id_produk)
          WHEN tl.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = tl.id_produk)
          WHEN tl.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = tl.id_produk)
          ELSE 0
        END) * tl.jumlah)
        - ((CASE 
          WHEN tl.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = tl.id_produk)
          WHEN tl.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = tl.id_produk)
          WHEN tl.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = tl.id_produk)
          WHEN tl.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = tl.id_produk)
          ELSE 0
        END) * tl.jumlah)) AS laba_item
      FROM transaksi_log tl
        LEFT JOIN transaksi t ON t.kode_transaksi = tl.id_grosir
        LEFT JOIN customer c ON c.kode_customer = t.kode_customer
        LEFT JOIN admin ON admin.id = t.id_marketing
      ${where}
      ORDER BY id_sg_log DESC
      LIMIT ? OFFSET ?`
  const out = []
  for (let i = 0; i < maxBatches; i++) {
    const offset = i * limit
    const [rows] = await pool.query({ sql, timeout: 60000 }, [...paramsBase, ...paramsBase, limit, offset])
    out.push(...rows)
    if (rows.length < limit) break
  }
  return out
}

export async function fetchMarketingProductItemsPage({ marketingId, pembukuanId, limit = 2000, offset = 0 }) {
  const active = Number.isInteger(pembukuanId) ? await getActivePembukuan(pembukuanId) : null
  const paramsBase = []
  let where = 'WHERE 1=1'
  if (marketingId) { where += ' AND t.id_marketing = ?'; paramsBase.push(marketingId) }
  if (active) { where += ' AND t.tanggal_order BETWEEN ? AND ?'; paramsBase.push(active.tanggal_buka_buku, active.tanggal_tutup_buku) }
  const sql = `SELECT
        t.kode_transaksi,
        c.nama_customer,
        admin.nama_lengkap,
        tl.jenis_produk,
        NULL AS jenis_sub_trx,
        tl.jumlah,
        tl.id_produk,
        tl.harga_produk,
        tl.jumlah_harga,
        tl.tanggal_log,
        tl.id_sg_log,
        CASE 
          WHEN tl.jenis_produk = 'katalog' THEN (SELECT CONCAT(nama_produk, ' (', sku_katalog, ')') FROM produk WHERE produk.id_produk = tl.id_produk)
          WHEN tl.jenis_produk = 'softlens' THEN (SELECT CONCAT(nama_softlens, ' (', sku_softlens, ')') FROM softlens WHERE softlens.id_softlens = tl.id_produk)
          WHEN tl.jenis_produk = 'lensa' THEN (SELECT CONCAT(nama_lensa_kat, ' ', size, ' | ', sku_lensa) FROM (SELECT id_lensa, sku_lensa, nama_lensa_kat, size FROM lensa JOIN lensa_kat ON lensa_kat.id_lensa_kat=lensa.id_lensa_kat) lensa WHERE lensa.id_lensa = tl.id_produk)
          WHEN tl.jenis_produk = 'frame' THEN (SELECT CONCAT((SELECT nama_frame FROM frame_kat WHERE frame_kat.id_kat_frame = frame.id_kat_frame), ' (', sku_frame, ')') FROM frame WHERE frame.id_frame = tl.id_produk)
          ELSE CONCAT('ID ', tl.id_produk)
        END AS nama_produk,
        CASE 
          WHEN tl.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = tl.id_produk)
          WHEN tl.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = tl.id_produk)
          WHEN tl.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = tl.id_produk)
          WHEN tl.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = tl.id_produk)
          ELSE 0
        END AS harga_modal,
        (CASE 
          WHEN tl.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = tl.id_produk)
          WHEN tl.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = tl.id_produk)
          WHEN tl.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = tl.id_produk)
          WHEN tl.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = tl.id_produk)
          ELSE 0
        END) * tl.jumlah AS jumlah_modal,
        CASE 
          WHEN tl.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = tl.id_produk)
          WHEN tl.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = tl.id_produk)
          WHEN tl.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = tl.id_produk)
          WHEN tl.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = tl.id_produk)
          ELSE 0
        END AS harga_ongkir,
        (CASE 
          WHEN tl.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = tl.id_produk)
          WHEN tl.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = tl.id_produk)
          WHEN tl.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = tl.id_produk)
          WHEN tl.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = tl.id_produk)
          ELSE 0
        END) * tl.jumlah AS jumlah_ongkir,
        ((CASE 
          WHEN tl.jumlah_harga = 0 THEN (tl.harga_produk * tl.jumlah)
          ELSE tl.jumlah_harga
        END) - ((CASE 
          WHEN tl.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = tl.id_produk)
          WHEN tl.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = tl.id_produk)
          WHEN tl.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = tl.id_produk)
          WHEN tl.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = tl.id_produk)
          ELSE 0
        END) * tl.jumlah)
        - ((CASE 
          WHEN tl.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = tl.id_produk)
          WHEN tl.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = tl.id_produk)
          WHEN tl.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = tl.id_produk)
          WHEN tl.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = tl.id_produk)
          ELSE 0
        END) * tl.jumlah)) AS laba_item
      FROM transaksi_log tl
        LEFT JOIN transaksi t ON t.id_transaksi = tl.id_grosir
        LEFT JOIN customer c ON c.kode_customer = t.kode_customer
        LEFT JOIN admin ON admin.id = t.id_marketing
      ${where}
      UNION ALL
      SELECT
        t.kode_transaksi,
        c.nama_customer,
        admin.nama_lengkap,
        tl.jenis_produk,
        NULL AS jenis_sub_trx,
        tl.jumlah,
        tl.id_produk,
        tl.harga_produk,
        tl.jumlah_harga,
        tl.tanggal_log,
        tl.id_sg_log,
        CASE 
          WHEN tl.jenis_produk = 'katalog' THEN (SELECT CONCAT(nama_produk, ' (', sku_katalog, ')') FROM produk WHERE produk.id_produk = tl.id_produk)
          WHEN tl.jenis_produk = 'softlens' THEN (SELECT CONCAT(nama_softlens, ' (', sku_softlens, ')') FROM softlens WHERE softlens.id_softlens = tl.id_produk)
          WHEN tl.jenis_produk = 'lensa' THEN (SELECT CONCAT(nama_lensa_kat, ' ', size, ' | ', sku_lensa) FROM (SELECT id_lensa, sku_lensa, nama_lensa_kat, size FROM lensa JOIN lensa_kat ON lensa_kat.id_lensa_kat=lensa.id_lensa_kat) lensa WHERE lensa.id_lensa = tl.id_produk)
          WHEN tl.jenis_produk = 'frame' THEN (SELECT CONCAT((SELECT nama_frame FROM frame_kat WHERE frame_kat.id_kat_frame = frame.id_kat_frame), ' (', sku_frame, ')') FROM frame WHERE frame.id_frame = tl.id_produk)
          ELSE CONCAT('ID ', tl.id_produk)
        END AS nama_produk,
        CASE 
          WHEN tl.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = tl.id_produk)
          WHEN tl.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = tl.id_produk)
          WHEN tl.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = tl.id_produk)
          WHEN tl.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = tl.id_produk)
          ELSE 0
        END AS harga_modal,
        (CASE 
          WHEN tl.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = tl.id_produk)
          WHEN tl.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = tl.id_produk)
          WHEN tl.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = tl.id_produk)
          WHEN tl.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = tl.id_produk)
          ELSE 0
        END) * tl.jumlah AS jumlah_modal,
        CASE 
          WHEN tl.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = tl.id_produk)
          WHEN tl.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = tl.id_produk)
          WHEN tl.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = tl.id_produk)
          WHEN tl.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = tl.id_produk)
          ELSE 0
        END AS harga_ongkir,
        (CASE 
          WHEN tl.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = tl.id_produk)
          WHEN tl.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = tl.id_produk)
          WHEN tl.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = tl.id_produk)
          WHEN tl.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = tl.id_produk)
          ELSE 0
        END) * tl.jumlah AS jumlah_ongkir,
        ((CASE 
          WHEN tl.jumlah_harga = 0 THEN (tl.harga_produk * tl.jumlah)
          ELSE tl.jumlah_harga
        END) - ((CASE 
          WHEN tl.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = tl.id_produk)
          WHEN tl.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = tl.id_produk)
          WHEN tl.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = tl.id_produk)
          WHEN tl.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = tl.id_produk)
          ELSE 0
        END) * tl.jumlah)
        - ((CASE 
          WHEN tl.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = tl.id_produk)
          WHEN tl.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = tl.id_produk)
          WHEN tl.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = tl.id_produk)
          WHEN tl.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = tl.id_produk)
          ELSE 0
        END) * tl.jumlah)) AS laba_item
      FROM transaksi_log tl
        LEFT JOIN transaksi t ON t.kode_transaksi = tl.id_grosir
        LEFT JOIN customer c ON c.kode_customer = t.kode_customer
        LEFT JOIN admin ON admin.id = t.id_marketing
      ${where}
      ORDER BY id_sg_log DESC
      LIMIT ? OFFSET ?`
  const [rows] = await pool.query({ sql, timeout: 60000 }, [...paramsBase, ...paramsBase, limit, offset])
  return rows
}

export async function fetchMarketingProductItemsCorePage({ marketingId, pembukuanId, cabangId, limit = 2000, offset = 0 }) {
  const active = Number.isInteger(pembukuanId) ? await getActivePembukuan(pembukuanId) : null
  const paramsT = []
  const paramsG = []
  let whereT = 'WHERE 1=1'
  if (marketingId) { whereT += ' AND t.id_marketing = ?'; paramsT.push(marketingId) }
  if (cabangId) { whereT += ' AND t.id_cabang = ?'; paramsT.push(cabangId) }
  if (active) { whereT += ' AND t.tanggal_order BETWEEN ? AND ?'; paramsT.push(active.tanggal_buka_buku, active.tanggal_tutup_buku) }
  let whereG = 'WHERE 1=1'
  if (cabangId) { whereG += ' AND g.id_cabang = ?'; paramsG.push(cabangId) }
  if (active) { whereG += ' AND gl.tanggal_log BETWEEN ? AND ?'; paramsG.push(active.tanggal_buka_buku, active.tanggal_tutup_buku) }
  const sql = `SELECT * FROM (
      SELECT
        t.kode_transaksi,
        c.nama_customer,
        admin.nama_lengkap,
        cabang_toko.nama_cabang,
        tl.jenis_produk,
        NULL AS jenis_sub_trx,
        tl.jumlah,
        tl.id_produk,
        tl.harga_produk,
        tl.jumlah_harga,
        tl.tanggal_log,
        tl.id_sg_log
      FROM transaksi_log tl
        LEFT JOIN transaksi t ON t.id_transaksi = tl.id_grosir
        LEFT JOIN customer c ON c.kode_customer = t.kode_customer
        LEFT JOIN admin ON admin.id = t.id_marketing
        LEFT JOIN cabang_toko ON cabang_toko.id_cabang = t.id_cabang
      ${whereT}
      UNION ALL
      SELECT
        g.kode_grosir AS kode_transaksi,
        c.nama_customer,
        NULL AS nama_lengkap,
        cabang_toko.nama_cabang,
        gl.jenis_produk,
        NULL AS jenis_sub_trx,
        gl.jumlah,
        gl.id_produk,
        gl.harga_produk,
        gl.jumlah_harga,
        gl.tanggal_log,
        gl.id_sg_log
      FROM grosir_log gl
        LEFT JOIN grosir g ON g.kode_grosir = gl.id_grosir
        LEFT JOIN customer c ON c.kode_customer = g.kode_customer
        LEFT JOIN cabang_toko ON cabang_toko.id_cabang = g.id_cabang
      ${whereG}
    ) u
    ORDER BY u.id_sg_log DESC
    LIMIT ? OFFSET ?`
  const [rows] = await pool.query({ sql, timeout: 60000 }, [...paramsT, ...paramsG, limit, offset])
  return rows
}

export async function enrichProductRows(rows) {
  const katalogIds = []
  const softlensIds = []
  const lensaIds = []
  const frameIds = []
  for (const r of rows) {
    if (r.jenis_produk === 'katalog') katalogIds.push(r.id_produk)
    else if (r.jenis_produk === 'softlens') softlensIds.push(r.id_produk)
    else if (r.jenis_produk === 'lensa') lensaIds.push(r.id_produk)
    else if (r.jenis_produk === 'frame') frameIds.push(r.id_produk)
  }
  const maps = { katalog: new Map(), softlens: new Map(), lensa: new Map(), frame: new Map() }
  if (katalogIds.length) {
    const [rowsK] = await pool.query('SELECT id_produk, nama_produk, sku_katalog, harga_modal, harga_ongkir FROM produk WHERE id_produk IN (?)', [katalogIds])
    for (const x of rowsK) { maps.katalog.set(x.id_produk, x) }
  }
  if (softlensIds.length) {
    const [rowsS] = await pool.query('SELECT id_softlens, nama_softlens, sku_softlens, harga_modal, harga_ongkir FROM softlens WHERE id_softlens IN (?)', [softlensIds])
    for (const x of rowsS) { maps.softlens.set(x.id_softlens, x) }
  }
  if (lensaIds.length) {
    const [rowsL] = await pool.query(`SELECT l.id_lensa, l.sku_lensa, lk.nama_lensa_kat, l.size, l.harga_modal, l.harga_ongkir FROM lensa l JOIN lensa_kat lk ON lk.id_lensa_kat = l.id_lensa_kat WHERE l.id_lensa IN (?)`, [lensaIds])
    for (const x of rowsL) { maps.lensa.set(x.id_lensa, x) }
  }
  if (frameIds.length) {
    const [rowsF] = await pool.query(`SELECT f.id_frame, f.sku_frame, fk.nama_frame, f.harga_modal, f.harga_ongkir FROM frame f JOIN frame_kat fk ON fk.id_kat_frame = f.id_kat_frame WHERE f.id_frame IN (?)`, [frameIds])
    for (const x of rowsF) { maps.frame.set(x.id_frame, x) }
  }
  const out = []
  for (const r of rows) {
    let harga_modal = 0, harga_ongkir = 0, nama_produk = `ID ${r.id_produk}`
    if (r.jenis_produk === 'katalog') {
      const x = maps.katalog.get(r.id_produk)
      if (x) { harga_modal = x.harga_modal || 0; harga_ongkir = x.harga_ongkir || 0; nama_produk = `${x.nama_produk} (${x.sku_katalog})` }
    } else if (r.jenis_produk === 'softlens') {
      const x = maps.softlens.get(r.id_produk)
      if (x) { harga_modal = x.harga_modal || 0; harga_ongkir = x.harga_ongkir || 0; nama_produk = `${x.nama_softlens} (${x.sku_softlens})` }
    } else if (r.jenis_produk === 'lensa') {
      const x = maps.lensa.get(r.id_produk)
      if (x) { harga_modal = x.harga_modal || 0; harga_ongkir = x.harga_ongkir || 0; nama_produk = `${x.nama_lensa_kat} ${x.size} | ${x.sku_lensa}` }
    } else if (r.jenis_produk === 'frame') {
      const x = maps.frame.get(r.id_produk)
      if (x) { harga_modal = x.harga_modal || 0; harga_ongkir = x.harga_ongkir || 0; nama_produk = `${x.nama_frame} (${x.sku_frame})` }
    }
    const jumlah_modal = harga_modal * r.jumlah
    const jumlah_ongkir = harga_ongkir * r.jumlah
    const nilai = r.jumlah_harga && r.jumlah_harga !== 0 ? r.jumlah_harga : (r.harga_produk * r.jumlah)
    const laba_item = nilai - jumlah_modal - jumlah_ongkir
    out.push({
      kode_transaksi: r.kode_transaksi,
      nama_customer: r.nama_customer,
      nama_lengkap: r.nama_lengkap,
      nama_cabang: r.nama_cabang,
      jenis_produk: r.jenis_produk,
      jenis_sub_trx: null,
      jumlah: r.jumlah,
      id_produk: r.id_produk,
      harga_produk: r.harga_produk,
      jumlah_harga: r.jumlah_harga,
      tanggal_log: r.tanggal_log,
      id_sg_log: r.id_sg_log,
      nama_produk,
      harga_modal,
      jumlah_modal,
      harga_ongkir,
      jumlah_ongkir,
      laba_item
    })
  }
  return out
}

export async function countMarketingProductItems({ marketingId, pembukuanId, cabangId }) {
  const active = Number.isInteger(pembukuanId) ? await getActivePembukuan(pembukuanId) : null
  const paramsT = []
  let whereT = 'WHERE 1=1'
  if (marketingId) { whereT += ' AND t.id_marketing = ?'; paramsT.push(marketingId) }
  if (cabangId) { whereT += ' AND t.id_cabang = ?'; paramsT.push(cabangId) }
  if (active) { whereT += ' AND t.tanggal_order BETWEEN ? AND ?'; paramsT.push(active.tanggal_buka_buku, active.tanggal_tutup_buku) }
  const paramsG = []
  let whereG = 'WHERE 1=1'
  if (cabangId) { whereG += ' AND g.id_cabang = ?'; paramsG.push(cabangId) }
  if (active) { whereG += ' AND gl.tanggal_log BETWEEN ? AND ?'; paramsG.push(active.tanggal_buka_buku, active.tanggal_tutup_buku) }
  const [cntT] = await pool.query({ sql: `SELECT COUNT(*) AS cnt FROM transaksi_log tl LEFT JOIN transaksi t ON t.id_transaksi = tl.id_grosir ${whereT}`, timeout: 30000 }, paramsT)
  const [cntG] = await pool.query({ sql: `SELECT COUNT(*) AS cnt FROM grosir_log gl LEFT JOIN grosir g ON g.kode_grosir = gl.id_grosir ${whereG}`, timeout: 30000 }, paramsG)
  return Number(cntT?.[0]?.cnt || 0) + Number(cntG?.[0]?.cnt || 0)
}

export async function fetchMarketingMonthlyTransactions({ marketingId, pembukuanId }) {
  const active = Number.isInteger(pembukuanId) ? await getActivePembukuan(pembukuanId) : null
  const params = []
  let where = 'WHERE 1=1'
  if (marketingId) { where += ' AND t.id_marketing = ?'; params.push(marketingId) }
  if (active) { where += ' AND t.tanggal_order BETWEEN ? AND ?'; params.push(active.tanggal_buka_buku, active.tanggal_tutup_buku) }
  const [rows] = await pool.query({
    sql: `SELECT DATE_FORMAT(t.tanggal_order, '%Y-%m') AS bulan,
            COUNT(*) AS total_transaksi,
            SUM(CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) AS total_fix,
            SUM(IFNULL(tp.jml_bayar,0)) AS total_bayar,
            SUM((CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) - IFNULL(tp.jml_bayar,0)) AS total_sisa
     FROM transaksi t
       LEFT JOIN (
         SELECT kode_transaksi, SUM(jumlah_bayar + IFNULL(bayar_lain, 0) + IFNULL(potong_marketing, 0)) AS jml_bayar
         FROM transaksi_pembayaran
         WHERE (jenis_transaksi IS NULL OR UPPER(jenis_transaksi) <> 'PIUTANG')
         GROUP BY kode_transaksi
       ) tp ON tp.kode_transaksi = t.kode_transaksi
     ${where}
     GROUP BY bulan
     ORDER BY bulan ASC`,
    timeout: 60000
  }, params)
  return rows
}

export async function fetchMarketingTransactionsBasic({ marketingId, pembukuanId }) {
  const active = Number.isInteger(pembukuanId) ? await getActivePembukuan(pembukuanId) : null
  const params = []
  let where = 'WHERE 1=1'
  if (marketingId) { where += ' AND t.id_marketing = ?'; params.push(marketingId) }
  if (active) { where += ' AND t.tanggal_order BETWEEN ? AND ?'; params.push(active.tanggal_buka_buku, active.tanggal_tutup_buku) }
  const sql = `
    SELECT t.id_transaksi,
           t.kode_transaksi,
           t.tanggal_order,
           admin.nama_lengkap AS nama_marketing,
           cabang_toko.nama_cabang,
           customer.nama_customer,
           customer.kode_customer AS kode_customer,
           customer.status_user AS status_user,
           (CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) AS fix_harga,
           (
             SELECT SUM(IFNULL(jumlah_bayar,0))
             FROM transaksi_pembayaran pSum
             WHERE pSum.kode_transaksi = t.kode_transaksi
               AND (pSum.jenis_transaksi IS NULL OR UPPER(pSum.jenis_transaksi) <> 'PIUTANG')
           ) AS jml_bayar,
           (
             (CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) -
             IFNULL((
               SELECT SUM(IFNULL(jumlah_bayar,0))
               FROM transaksi_pembayaran pSum2
               WHERE pSum2.kode_transaksi = t.kode_transaksi
                 AND (pSum2.jenis_transaksi IS NULL OR UPPER(pSum2.jenis_transaksi) <> 'PIUTANG')
             ),0)
           ) AS sisa_bayar
    FROM transaksi t
      LEFT JOIN admin ON admin.id = t.id_marketing
      LEFT JOIN cabang_toko ON cabang_toko.id_cabang = t.id_cabang
      LEFT JOIN customer ON customer.kode_customer = t.kode_customer
    ${where}
    ORDER BY t.tanggal_order ASC`
  const [rows] = await pool.query({ sql, timeout: 60000 }, params)
  return rows
}

export async function fetchMarketingItemsPeriod({ pembukuanId, cabangId }) {
  const active = await getActivePembukuan(pembukuanId)
  if (!active || !cabangId) return []
  const [rows] = await pool.query(
    `SELECT transaksi_log.id_grosir,
            t.kode_transaksi,
            c.nama_customer,
            admin.nama_lengkap,
            transaksi_log.jenis_produk, transaksi_log.jumlah, transaksi_log.id_produk,
            transaksi_log.harga_produk, transaksi_log.jumlah_harga, transaksi_log.tanggal_log,
            cabang_toko.nama_cabang,
      CASE 
        WHEN transaksi_log.jenis_produk = 'katalog' THEN (SELECT CONCAT(nama_produk, ' (', sku_katalog, ')') FROM produk WHERE produk.id_produk = transaksi_log.id_produk)
        WHEN transaksi_log.jenis_produk = 'softlens' THEN (SELECT CONCAT(nama_softlens, ' (', sku_softlens, ')') FROM softlens WHERE softlens.id_softlens = transaksi_log.id_produk)
        WHEN transaksi_log.jenis_produk = 'lensa' THEN (SELECT CONCAT(nama_lensa_kat, ' ', size, ' | ', sku_lensa) FROM (SELECT id_lensa, sku_lensa, nama_lensa_kat, size FROM lensa JOIN lensa_kat ON lensa_kat.id_lensa_kat=lensa.id_lensa_kat) lensa WHERE lensa.id_lensa = transaksi_log.id_produk)
        WHEN transaksi_log.jenis_produk = 'frame' THEN (SELECT CONCAT((SELECT nama_frame FROM frame_kat WHERE frame_kat.id_kat_frame = frame.id_kat_frame), ' (', sku_frame, ')') FROM frame WHERE frame.id_frame = transaksi_log.id_produk)
        ELSE CONCAT('ID ', transaksi_log.id_produk)
      END AS nama_produk,
      CASE 
        WHEN transaksi_log.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = transaksi_log.id_produk)
        WHEN transaksi_log.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = transaksi_log.id_produk)
        WHEN transaksi_log.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = transaksi_log.id_produk)
        WHEN transaksi_log.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = transaksi_log.id_produk)
        ELSE 0
      END AS harga_modal,
      (CASE 
        WHEN transaksi_log.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = transaksi_log.id_produk)
        WHEN transaksi_log.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = transaksi_log.id_produk)
        WHEN transaksi_log.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = transaksi_log.id_produk)
        WHEN transaksi_log.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = transaksi_log.id_produk)
        ELSE 0
      END) * transaksi_log.jumlah AS jumlah_modal,
      CASE 
        WHEN transaksi_log.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = transaksi_log.id_produk)
        WHEN transaksi_log.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = transaksi_log.id_produk)
        WHEN transaksi_log.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = transaksi_log.id_produk)
        WHEN transaksi_log.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = transaksi_log.id_produk)
        ELSE 0
      END AS harga_ongkir,
      (CASE 
        WHEN transaksi_log.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = transaksi_log.id_produk)
        WHEN transaksi_log.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = transaksi_log.id_produk)
        WHEN transaksi_log.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = transaksi_log.id_produk)
        WHEN transaksi_log.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = transaksi_log.id_produk)
        ELSE 0
      END) * transaksi_log.jumlah AS jumlah_ongkir,
      ((CASE 
        WHEN transaksi_log.jumlah_harga = 0 THEN (transaksi_log.harga_produk * transaksi_log.jumlah)
        ELSE transaksi_log.jumlah_harga
      END) - ((CASE 
        WHEN transaksi_log.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = transaksi_log.id_produk)
        WHEN transaksi_log.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = transaksi_log.id_produk)
        WHEN transaksi_log.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = transaksi_log.id_produk)
        WHEN transaksi_log.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = transaksi_log.id_produk)
        ELSE 0
     END) * transaksi_log.jumlah
     - (CASE 
        WHEN transaksi_log.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = transaksi_log.id_produk)
        WHEN transaksi_log.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = transaksi_log.id_produk)
        WHEN transaksi_log.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = transaksi_log.id_produk)
        WHEN transaksi_log.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = transaksi_log.id_produk)
        ELSE 0
     END) * transaksi_log.jumlah)) AS laba_item,
      (CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) AS fix_harga,
      COALESCE(tp.jml_bayar, 0) AS jml_bayar,
      ((CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) - COALESCE(tp.jml_bayar, 0)) AS sisa_bayar
     FROM transaksi_log 
       LEFT JOIN cabang_toko ON cabang_toko.id_cabang = transaksi_log.id_cabang
       LEFT JOIN transaksi t ON (t.id_transaksi = transaksi_log.id_grosir OR t.kode_transaksi = transaksi_log.id_grosir)
       LEFT JOIN customer c ON c.kode_customer = t.kode_customer
       LEFT JOIN admin ON admin.id = t.id_marketing
       LEFT JOIN (
         SELECT kode_transaksi, SUM(jumlah_bayar + IFNULL(bayar_lain, 0) + IFNULL(potong_marketing, 0)) AS jml_bayar
         FROM transaksi_pembayaran
         WHERE tanggal_bayar BETWEEN ? AND ? AND UPPER(jenis_transaksi) <> 'PIUTANG'
         GROUP BY kode_transaksi
       ) tp ON tp.kode_transaksi = t.kode_transaksi
     WHERE transaksi_log.tanggal_log BETWEEN ? AND ? AND transaksi_log.id_cabang = ?
     ORDER BY transaksi_log.id_sg_log DESC`,
    [active.tanggal_buka_buku, active.tanggal_tutup_buku, active.tanggal_buka_buku, active.tanggal_tutup_buku, cabangId]
  )
  return rows
}

const cleanFilename = (f) => {
  if (!f || typeof f !== 'string') return f
  // Defensive: if it contains a protocol or a slash before the filename, take only the last part
  if (f.includes('://') || f.includes('//') || f.includes('/')) {
    return f.split('/').pop()
  }
  return f
}

export async function fetchCustomerProfileByTrans({ kode }) {
  const [rows] = await pool.query(
    `SELECT c.kode_customer, c.nama_customer, c.alamat_lengkap, c.no_hp, c.kode_qr, c.jk,
            c.no_ktp, c.no_kk, c.tanggal_lahir, c.tempat_lahir,
            c.kabupaten, c.kecamatan, c.desa,
            c.cabang AS id_cabang, cabang_toko.nama_cabang,
            c.file_ktp, c.file_kk,
            c.status_user, c.blacklist_reason,
            admin.nama_lengkap AS nama_marketing,
            t.kode_transaksi, t.tanggal_order
     FROM transaksi t
       LEFT JOIN customer c ON c.kode_customer = t.kode_customer
       LEFT JOIN admin ON admin.id = t.id_marketing
       LEFT JOIN cabang_toko ON cabang_toko.id_cabang = t.id_cabang
     WHERE t.kode_transaksi = ?
     LIMIT 1`,
    [kode]
  )
  const p = rows?.[0] || null
  if (!p) return null
  return {
    ...p,
    file_ktp_url: p.file_ktp ? `https://ap2.optiklivina.com/uploads/customer_ktp/${cleanFilename(p.file_ktp)}` : null,
    file_kk_url: p.file_kk ? `https://ap2.optiklivina.com/uploads/customer_kk/${cleanFilename(p.file_kk)}` : null
  }
}

export async function fetchProductTransactionsPage({ jenis, productId, cabangId, page = 1, limit = 20 }) {
  const j = String(jenis || '').toLowerCase()
  const allowed = new Set(['katalog', 'softlens', 'frame', 'lensa'])
  if (!allowed.has(j)) throw new Error('jenis invalid')
  const pid = Number(productId)
  if (!Number.isFinite(pid)) throw new Error('productId invalid')
  const offset = Math.max(0, (Number(page) - 1) * Number(limit))
  const paramsBase = []
  let where = 'WHERE 1=1'
  where += ' AND LOWER(transaksi_log.jenis_produk) = ?'; paramsBase.push(j)
  where += ' AND transaksi_log.id_produk = ?'; paramsBase.push(pid)
  if (cabangId) { where += ' AND t.id_cabang = ?'; paramsBase.push(cabangId) }
  const whereG = 'WHERE LOWER(gl.jenis_produk) = ? AND gl.id_produk = ?' + (cabangId ? ' AND g.id_cabang = ?' : '')
  const paramsG = cabangId ? [j, pid, cabangId] : [j, pid]
  const sql = `
    SELECT * FROM (
      SELECT transaksi_log.id_sg_log AS sort_id,
             transaksi_log.id_grosir,
             t.kode_transaksi,
             c.nama_customer,
             admin.nama_lengkap,
             cabang_toko.nama_cabang,
             transaksi_log.jenis_produk, transaksi_log.jumlah, transaksi_log.id_produk,
             transaksi_log.harga_produk, transaksi_log.jumlah_harga, transaksi_log.tanggal_log,
             CASE 
               WHEN transaksi_log.jenis_produk = 'katalog' THEN (SELECT CONCAT(nama_produk, ' (', sku_katalog, ')') FROM produk WHERE produk.id_produk = transaksi_log.id_produk)
               WHEN transaksi_log.jenis_produk = 'softlens' THEN (SELECT CONCAT(nama_softlens, ' (', sku_softlens, ')') FROM softlens WHERE softlens.id_softlens = transaksi_log.id_produk)
               WHEN transaksi_log.jenis_produk = 'lensa' THEN (SELECT CONCAT(nama_lensa_kat, ' ', size, ' | ', sku_lensa) FROM (SELECT id_lensa, sku_lensa, nama_lensa_kat, size FROM lensa JOIN lensa_kat ON lensa_kat.id_lensa_kat=lensa.id_lensa_kat) lensa WHERE lensa.id_lensa = transaksi_log.id_produk)
               WHEN transaksi_log.jenis_produk = 'frame' THEN (SELECT CONCAT((SELECT nama_frame FROM frame_kat WHERE frame_kat.id_kat_frame = frame.id_kat_frame), ' (', sku_frame, ')') FROM frame WHERE frame.id_frame = transaksi_log.id_produk)
               ELSE CONCAT('ID ', transaksi_log.id_produk)
             END AS nama_produk,
             CASE 
               WHEN transaksi_log.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = transaksi_log.id_produk)
               WHEN transaksi_log.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = transaksi_log.id_produk)
               WHEN transaksi_log.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = transaksi_log.id_produk)
               WHEN transaksi_log.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = transaksi_log.id_produk)
               ELSE 0
             END AS harga_modal,
             (CASE 
               WHEN transaksi_log.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = transaksi_log.id_produk)
               WHEN transaksi_log.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = transaksi_log.id_produk)
               WHEN transaksi_log.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = transaksi_log.id_produk)
               WHEN transaksi_log.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = transaksi_log.id_produk)
               ELSE 0
             END) * transaksi_log.jumlah AS jumlah_modal,
             CASE 
               WHEN transaksi_log.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = transaksi_log.id_produk)
               WHEN transaksi_log.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = transaksi_log.id_produk)
               WHEN transaksi_log.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = transaksi_log.id_produk)
               WHEN transaksi_log.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = transaksi_log.id_produk)
               ELSE 0
             END AS harga_ongkir,
             (CASE 
               WHEN transaksi_log.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = transaksi_log.id_produk)
               WHEN transaksi_log.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = transaksi_log.id_produk)
               WHEN transaksi_log.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = transaksi_log.id_produk)
               WHEN transaksi_log.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = transaksi_log.id_produk)
               ELSE 0
             END) * transaksi_log.jumlah AS jumlah_ongkir,
             ((CASE 
               WHEN transaksi_log.jumlah_harga = 0 THEN (transaksi_log.harga_produk * transaksi_log.jumlah)
               ELSE transaksi_log.jumlah_harga
             END) - ((CASE 
               WHEN transaksi_log.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = transaksi_log.id_produk)
               WHEN transaksi_log.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = transaksi_log.id_produk)
               WHEN transaksi_log.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = transaksi_log.id_produk)
               WHEN transaksi_log.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = transaksi_log.id_produk)
               ELSE 0
             END) * transaksi_log.jumlah
             - (CASE 
               WHEN transaksi_log.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = transaksi_log.id_produk)
               WHEN transaksi_log.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = transaksi_log.id_produk)
               WHEN transaksi_log.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = transaksi_log.id_produk)
               WHEN transaksi_log.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = transaksi_log.id_produk)
               ELSE 0
             END) * transaksi_log.jumlah)) AS laba_item
      FROM transaksi_log 
        LEFT JOIN transaksi t ON (t.id_transaksi = transaksi_log.id_grosir OR t.kode_transaksi = transaksi_log.id_grosir)
        LEFT JOIN customer c ON c.kode_customer = t.kode_customer
        LEFT JOIN admin ON admin.id = t.id_marketing
        LEFT JOIN cabang_toko ON cabang_toko.id_cabang = t.id_cabang
      ${where}
      UNION ALL
      SELECT gl.id_sg_log AS sort_id,
             gl.id_grosir,
             g.kode_grosir AS kode_transaksi,
             c.nama_customer,
             NULL AS nama_lengkap,
             cabang_toko.nama_cabang,
             gl.jenis_produk, gl.jumlah, gl.id_produk,
             gl.harga_produk, gl.jumlah_harga, gl.tanggal_log,
             CASE 
               WHEN gl.jenis_produk = 'katalog' THEN (SELECT CONCAT(nama_produk, ' (', sku_katalog, ')') FROM produk WHERE produk.id_produk = gl.id_produk)
               WHEN gl.jenis_produk = 'softlens' THEN (SELECT CONCAT(nama_softlens, ' (', sku_softlens, ')') FROM softlens WHERE softlens.id_softlens = gl.id_produk)
               WHEN gl.jenis_produk = 'lensa' THEN (SELECT CONCAT(nama_lensa_kat, ' ', size, ' | ', sku_lensa) FROM (SELECT id_lensa, sku_lensa, nama_lensa_kat, size FROM lensa JOIN lensa_kat ON lensa_kat.id_lensa_kat=lensa.id_lensa_kat) lensa WHERE lensa.id_lensa = gl.id_produk)
               WHEN gl.jenis_produk = 'frame' THEN (SELECT CONCAT((SELECT nama_frame FROM frame_kat WHERE frame_kat.id_kat_frame = frame.id_kat_frame), ' (', sku_frame, ')') FROM frame WHERE frame.id_frame = gl.id_produk)
               ELSE CONCAT('ID ', gl.id_produk)
             END AS nama_produk,
             CASE 
               WHEN gl.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = gl.id_produk)
               WHEN gl.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = gl.id_produk)
               WHEN gl.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = gl.id_produk)
               WHEN gl.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = gl.id_produk)
               ELSE 0
             END AS harga_modal,
             (CASE 
               WHEN gl.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = gl.id_produk)
               WHEN gl.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = gl.id_produk)
               WHEN gl.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = gl.id_produk)
               WHEN gl.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = gl.id_produk)
               ELSE 0
             END) * gl.jumlah AS jumlah_modal,
             CASE 
               WHEN gl.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = gl.id_produk)
               WHEN gl.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = gl.id_produk)
               WHEN gl.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = gl.id_produk)
               WHEN gl.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = gl.id_produk)
               ELSE 0
             END AS harga_ongkir,
             (CASE 
               WHEN gl.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = gl.id_produk)
               WHEN gl.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = gl.id_produk)
               WHEN gl.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = gl.id_produk)
               WHEN gl.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = gl.id_produk)
               ELSE 0
             END) * gl.jumlah AS jumlah_ongkir,
             ((CASE 
               WHEN gl.jumlah_harga = 0 THEN (gl.harga_produk * gl.jumlah)
               ELSE gl.jumlah_harga
             END) - ((CASE 
               WHEN gl.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = gl.id_produk)
               WHEN gl.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = gl.id_produk)
               WHEN gl.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = gl.id_produk)
               WHEN gl.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = gl.id_produk)
               ELSE 0
             END) * gl.jumlah
             - (CASE 
               WHEN gl.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = gl.id_produk)
               WHEN gl.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = gl.id_produk)
               WHEN gl.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = gl.id_produk)
               WHEN gl.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = gl.id_produk)
               ELSE 0
             END) * gl.jumlah)) AS laba_item
      FROM grosir_log gl
        LEFT JOIN grosir g ON g.kode_grosir = gl.id_grosir
        LEFT JOIN customer c ON c.kode_customer = g.kode_customer
        LEFT JOIN cabang_toko ON cabang_toko.id_cabang = g.id_cabang
      ${whereG}
    ) u
    ORDER BY u.sort_id DESC
    LIMIT ? OFFSET ?`
  const [rows] = await pool.query({ sql, timeout: 30000 }, [...paramsBase, ...paramsG, Number(limit), Number(offset)])
  const whereCntTL = where.replaceAll('transaksi_log', 'tl')
  const [cntRows1] = await pool.query({
    sql: `SELECT COUNT(*) AS cnt FROM transaksi_log tl LEFT JOIN transaksi t ON (t.id_transaksi = tl.id_grosir OR t.kode_transaksi = tl.id_grosir) ${whereCntTL}`,
    timeout: 30000
  }, paramsBase)
  const [cntRows2] = await pool.query({
    sql: `SELECT COUNT(*) AS cnt FROM grosir_log gl LEFT JOIN grosir g ON g.kode_grosir = gl.id_grosir ${whereG}`,
    timeout: 30000
  }, paramsG)
  const total = Number(cntRows1?.[0]?.cnt || 0) + Number(cntRows2?.[0]?.cnt || 0)
  return { data: rows, meta: { page, limit, total, totalPages: limit > 0 ? Math.ceil(total / limit) : 1 } }
}

export async function fetchCustomerProfileByCode({ kode }) {
  const [rows] = await pool.query(
    `SELECT c.kode_customer, c.nama_customer, c.alamat_lengkap, c.no_hp, c.kode_qr, c.jk,
            c.no_ktp, c.no_kk, c.tanggal_lahir, c.tempat_lahir,
            c.kabupaten, c.kecamatan, c.desa,
            c.cabang AS id_cabang, cabang_toko.nama_cabang,
            c.file_ktp, c.file_kk,
            c.status_user, c.blacklist_reason,
            admin.nama_lengkap AS nama_marketing
     FROM customer c
       LEFT JOIN admin ON admin.id = c.id_marketing
       LEFT JOIN cabang_toko ON cabang_toko.id_cabang = c.cabang
     WHERE c.kode_customer = ? OR c.kode_qr = ?
     LIMIT 1`,
    [kode, kode]
  )
  const p = rows?.[0] || null
  if (!p) return null

  return {
    ...p,
    file_ktp_url: p.file_ktp ? `https://ap2.optiklivina.com/uploads/customer_ktp/${cleanFilename(p.file_ktp)}` : null,
    file_kk_url: p.file_kk ? `https://ap2.optiklivina.com/uploads/customer_kk/${cleanFilename(p.file_kk)}` : null
  }
}


export async function fetchCustomers({ page = 1, limit = 20, cabangId, marketingId, ktp, kk, aging, doc, q, addr, status, unpaid }) {
  const offset = Math.max(0, (Number(page) - 1) * Number(limit));
  const must = [];
  const must_not = [];

  if (cabangId) must.push({ term: { cabang: cabangId } });
  if (marketingId) must.push({ term: { id_marketing: marketingId } });
  if (status === 'blacklist') must.push({ term: { status_user: 'blacklist' } });
  if (status === 'normal') must_not.push({ term: { status_user: 'blacklist' } });

  if (q) {
    must.push({
      multi_match: {
        query: String(q).toLowerCase(),
        fields: ['nama_customer', 'no_hp', 'no_ktp'],
        type: 'phrase_prefix'
      }
    });
  }
  if (addr) {
    must.push({ match: { alamat_lengkap: String(addr).toLowerCase() } });
  }

  if (doc === 'ktp') must.push({ exists: { field: 'file_ktp' } });
  if (doc === 'kk') must.push({ exists: { field: 'file_kk' } });
  if (doc === 'lengkap') must.push({ term: { dokumen_lengkap: true } });
  
  if (!doc) {
    if (ktp === 'lengkap') must.push({ exists: { field: 'file_ktp' } });
    if (kk === 'lengkap') must.push({ exists: { field: 'file_kk' } });
  }

  if (unpaid === '1' || unpaid === 'true') must.push({ term: { status_pembayaran: 'belum_lunas' } });
  if (unpaid === 'lunas') must.push({ term: { status_pembayaran: 'lunas' } });

  if (aging === 'gt3') must.push({ range: { aging_months: { gt: 3 } } });
  if (aging === '6to12') must.push({ range: { aging_months: { gt: 6, lte: 12 } } });
  if (aging === 'gt12') must.push({ range: { aging_months: { gt: 12 } } });

  try {
    const res = await esClient.search({
      index: 'optik_customers',
      from: offset,
      size: Number(limit),
      body: {
        track_total_hits: true,
        query: {
          bool: {
            must,
            must_not
          }
        },
        sort: [
          { created_at: { order: 'desc' } },
          { id_customer: { order: 'desc' } }
        ]
      }
    });

    const total = res.hits.total.value;
    const mapped = res.hits.hits.map((hit, idx) => {
      const r = hit._source;
      return {
        ...r,
        sisa_total: r.sisa_hutang,
        nomor_urut: offset + idx + 1,
        file_ktp_url: r.file_ktp ? `https://ap2.optiklivina.com/uploads/customer_ktp/${r.file_ktp}` : null,
        file_kk_url: r.file_kk ? `https://ap2.optiklivina.com/uploads/customer_kk/${r.file_kk}` : null
      };
    });

    return { data: mapped, total };
  } catch (e) {
    console.error('[ES fetchCustomers]', e);
    return { data: [], total: 0 };
  }
}

export async function fetchCustomerStats({ cabangId, marketingId }) {
  const must = [];
  if (cabangId) must.push({ term: { cabang: cabangId } });
  if (marketingId) must.push({ term: { id_marketing: marketingId } });

  try {
    const res = await esClient.search({
      index: 'optik_customers',
      size: 0,
      body: {
        track_total_hits: true,
        query: { bool: { must } },
        aggs: {
          blacklist: { filter: { term: { status_user: 'blacklist' } } },
          complete: { filter: { term: { dokumen_lengkap: true } } },
          unpaid: { filter: { term: { status_pembayaran: 'belum_lunas' } } },
          lunas: { filter: { term: { status_pembayaran: 'lunas' } } }
        }
      }
    });

    const total = res.hits.total.value;
    const aggs = res.aggregations;
    
    return {
      total,
      blacklist: aggs.blacklist.doc_count,
      complete: aggs.complete.doc_count,
      unpaid: aggs.unpaid.doc_count,
      lunas: aggs.lunas.doc_count
    };
  } catch (e) {
    console.error('[ES fetchCustomerStats]', e);
    return { total: 0, blacklist: 0, complete: 0, unpaid: 0, lunas: 0 };
  }
}


export async function fetchCustomerSummaryByCode({ kode, limit = 50 }) {
  // profile
  const profile = await fetchCustomerProfileByCode({ kode })
  if (!profile) return { profile: null, transactions: [], points: { total_marketing: 0, total_used: 0 }, points_used_list: [] }

  const kodeCustomer = profile.kode_customer

  // transaksi marketing dengan poin per transaksi
  const [transRows] = await pool.query(
    `SELECT t.id_transaksi,
            t.kode_transaksi AS kode,
            t.jenis_beli AS tipe,
            cabang_toko.nama_cabang,
            admin.nama_lengkap AS nama_marketing,
            (CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) AS harga,
            IFNULL(tp.total_bayar, 0) AS j_bayar,
            ((CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) - IFNULL(tp.total_bayar, 0) - IFNULL(svu.total_voucher, 0)) AS sisa,
            t.tanggal_order AS tanggal,
            CASE
              WHEN t.jenis_beli = 'kacamata' AND (IFNULL(tp.total_bayar, 0) + IFNULL(svu.total_voucher, 0)) > 0 THEN (
                SELECT rp.poin FROM rule_poin rp
                WHERE (CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) BETWEEN rp.nominal AND rp.nominal_end
                LIMIT 1
              )
              ELSE 0
            END AS poin
     FROM transaksi t
       LEFT JOIN (
         SELECT kode_transaksi AS kode_transaksi_bayar, SUM(jumlah_bayar + IFNULL(bayar_lain, 0) + IFNULL(potong_marketing, 0)) AS total_bayar
         FROM transaksi_pembayaran
         GROUP BY kode_transaksi
       ) tp ON tp.kode_transaksi_bayar = t.kode_transaksi
       LEFT JOIN (
         SELECT kode_transaksi, SUM(voucher_use) AS total_voucher
         FROM sponsor_voucher_use
         GROUP BY kode_transaksi
       ) svu ON svu.kode_transaksi = t.kode_transaksi
       LEFT JOIN cabang_toko ON cabang_toko.id_cabang = t.id_cabang
       LEFT JOIN admin ON admin.id = t.id_marketing
     WHERE t.kode_customer = ?
     ORDER BY t.tanggal_order DESC
     LIMIT ?`,
    [kodeCustomer, Number(limit)]
  )

  // total poin marketing
  const [poinRows] = await pool.query(
    `SELECT SUM(
        CASE
          WHEN t.jenis_beli = 'kacamata' AND (IFNULL(tp.total_bayar, 0) + IFNULL(svu.total_voucher, 0)) > 0 THEN (
            SELECT rp.poin FROM rule_poin rp
            WHERE (CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) BETWEEN rp.nominal AND rp.nominal_end
            LIMIT 1
          )
          ELSE 0
        END
      ) AS total_poin
     FROM transaksi t
       LEFT JOIN (
         SELECT kode_transaksi AS kode_transaksi_bayar, SUM(jumlah_bayar + IFNULL(bayar_lain, 0) + IFNULL(potong_marketing, 0)) AS total_bayar
         FROM transaksi_pembayaran
         GROUP BY kode_transaksi
       ) tp ON tp.kode_transaksi_bayar = t.kode_transaksi
       LEFT JOIN (
         SELECT kode_transaksi, SUM(voucher_use) AS total_voucher
         FROM sponsor_voucher_use
         GROUP BY kode_transaksi
       ) svu ON svu.kode_transaksi = t.kode_transaksi
     WHERE t.kode_customer = ?`,
    [kodeCustomer]
  )
  const totalMarketing = Number(poinRows?.[0]?.total_poin || 0)

  // poin digunakan - Search by Customer Code OR by Transaction Codes belonging to this customer
  const trxCodes = transRows.map(r => r.kode).filter(Boolean)
  let sqlUsed = `SELECT id, kode_transaksi, point_use, tanggal_penggunaan AS tanggal
                 FROM bayar_point
                 WHERE kode_customer = ?`
  const paramsUsed = [kodeCustomer]

  if (trxCodes.length > 0) {
    sqlUsed += ` OR kode_transaksi IN (?)`
    paramsUsed.push(trxCodes)
  }

  sqlUsed += ` ORDER BY id DESC LIMIT 100`

  const [usedRows] = await pool.query(sqlUsed, paramsUsed)
  const totalUsed = usedRows.reduce((a, r) => a + Number(r.point_use || 0), 0)

  const payLimit = Number(limit) > 0 ? Number(limit) : 100
  const [payMarkRows] = await pool.query(
    `SELECT tp.id_pembayaran AS id, tp.kode_transaksi AS kode, tp.jumlah_bayar, tp.tanggal_bayar,
            UPPER(tp.jenis_transaksi) AS jenis_transaksi, tp.metode_setor, tp.id_rekening_setor,
            cabang_toko.nama_cabang
     FROM transaksi_pembayaran tp
       LEFT JOIN transaksi t ON t.kode_transaksi = tp.kode_transaksi
       LEFT JOIN cabang_toko ON cabang_toko.id_cabang = t.id_cabang
     WHERE t.kode_customer = ?
     ORDER BY tp.id_pembayaran DESC
     LIMIT ?`,
    [kodeCustomer, payLimit]
  )

  const [claimRows] = await pool.query(
    `SELECT ggl.id_sg_log AS id, ggl.id_grosir AS kode, ggl.jenis_produk, ggl.tanggal_log, ggl.jumlah,
            cabang_toko.nama_cabang,
            CASE WHEN t.kode_transaksi IS NOT NULL THEN 'marketing' ELSE 'toko' END AS jenis_nota
     FROM grosir_garansi_log ggl
       LEFT JOIN transaksi t ON t.kode_transaksi = ggl.id_grosir
       LEFT JOIN grosir gr ON gr.kode_grosir = ggl.id_grosir
       LEFT JOIN cabang_toko ON cabang_toko.id_cabang = ggl.id_cabang
     WHERE COALESCE(t.kode_customer, gr.kode_customer) = ?
     ORDER BY ggl.id_sg_log DESC
     LIMIT ?`,
    [kodeCustomer, payLimit]
  )

  return {
    profile,
    transactions: transRows,
    points: { total_marketing: totalMarketing, total_used: totalUsed },
    points_used_list: usedRows,
    payments: payMarkRows,
    warranty_claims: claimRows
  }
}

export async function fetchMarketingOverdue({ cabangId, marketingId, status, pembukuanId }) {
  const active = Number.isInteger(pembukuanId) ? await getActivePembukuan(pembukuanId) : null
  const params = []
  let where = 'WHERE 1=1'
  if (cabangId) { where += ' AND t.id_cabang = ?'; params.push(cabangId) }
  if (marketingId) { where += ' AND t.id_marketing = ?'; params.push(marketingId) }
  if (active) { where += ' AND t.tanggal_order BETWEEN ? AND ?'; params.push(active.tanggal_buka_buku, active.tanggal_tutup_buku) }
  const statusNorm = String(status || '').toLowerCase()
  if (statusNorm === 'blacklist') {
    where += " AND LOWER(customer.status_user) = 'blacklist'"
  } else if (statusNorm === 'nonblacklist') {
    where += " AND (customer.status_user IS NULL OR LOWER(customer.status_user) <> 'blacklist')"
  }

  const sql = `
    SELECT t.id_marketing,
           admin.nama_lengkap AS nama_marketing,
           t.id_cabang,
           cabang_toko.nama_cabang,
           SUM(CASE 
                 WHEN ((CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) - IFNULL(tp2.jml_bayar,0) - IFNULL(svu.total_voucher,0)) > 0
                  AND TIMESTAMPDIFF(MONTH, COALESCE(tp2.tanggal_bayar, t.tanggal_order), CURDATE()) <= 1
                  AND (customer.status_user IS NULL OR LOWER(customer.status_user) <> 'blacklist')
                 THEN (CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) - IFNULL(tp2.jml_bayar,0) - IFNULL(svu.total_voucher,0)
                 ELSE 0 END) AS tagihan_1_bulan,
           SUM(CASE 
                 WHEN ((CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) - IFNULL(tp2.jml_bayar,0) - IFNULL(svu.total_voucher,0)) > 0
                  AND TIMESTAMPDIFF(MONTH, COALESCE(tp2.tanggal_bayar, t.tanggal_order), CURDATE()) > 1
                  AND TIMESTAMPDIFF(MONTH, COALESCE(tp2.tanggal_bayar, t.tanggal_order), CURDATE()) <= 3
                  AND (customer.status_user IS NULL OR LOWER(customer.status_user) <> 'blacklist')
                 THEN (CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) - IFNULL(tp2.jml_bayar,0) - IFNULL(svu.total_voucher,0)
                 ELSE 0 END) AS tagihan_3_bulan,
           SUM(CASE 
                 WHEN ((CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) - IFNULL(tp2.jml_bayar,0) - IFNULL(svu.total_voucher,0)) > 0
                 AND TIMESTAMPDIFF(MONTH, COALESCE(tp2.tanggal_bayar, t.tanggal_order), CURDATE()) > 3
                 AND TIMESTAMPDIFF(MONTH, COALESCE(tp2.tanggal_bayar, t.tanggal_order), CURDATE()) <= 6
                 AND (customer.status_user IS NULL OR LOWER(customer.status_user) <> 'blacklist')
                 THEN (CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) - IFNULL(tp2.jml_bayar,0) - IFNULL(svu.total_voucher,0)
                 ELSE 0 END) AS tagihan_6_bulan,
           SUM(CASE 
                 WHEN ((CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) - IFNULL(tp2.jml_bayar,0) - IFNULL(svu.total_voucher,0)) > 0
                  AND TIMESTAMPDIFF(MONTH, COALESCE(tp2.tanggal_bayar, t.tanggal_order), CURDATE()) > 6
                  AND TIMESTAMPDIFF(MONTH, COALESCE(tp2.tanggal_bayar, t.tanggal_order), CURDATE()) <= 12
                  AND (customer.status_user IS NULL OR LOWER(customer.status_user) <> 'blacklist')
                 THEN (CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) - IFNULL(tp2.jml_bayar,0) - IFNULL(svu.total_voucher,0)
                 ELSE 0 END) AS tagihan_1_tahun,
           SUM(CASE 
                 WHEN ((CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) - IFNULL(tp2.jml_bayar,0) - IFNULL(svu.total_voucher,0)) > 0
                  AND TIMESTAMPDIFF(MONTH, COALESCE(tp2.tanggal_bayar, t.tanggal_order), CURDATE()) > 12
                  AND (customer.status_user IS NULL OR LOWER(customer.status_user) <> 'blacklist')
                 THEN (CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) - IFNULL(tp2.jml_bayar,0) - IFNULL(svu.total_voucher,0)
                 ELSE 0 END) AS tagihan_gt_1_tahun,
           SUM(CASE 
                 WHEN ((CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) - IFNULL(tp2.jml_bayar,0) - IFNULL(svu.total_voucher,0)) > 0
                  AND (customer.status_user IS NULL OR LOWER(customer.status_user) <> 'blacklist')
                 THEN (CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) - IFNULL(tp2.jml_bayar,0) - IFNULL(svu.total_voucher,0)
                 ELSE 0 END) AS total_macet,
           SUM(CASE 
                 WHEN ((CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) - IFNULL(tp2.jml_bayar,0) - IFNULL(svu.total_voucher,0)) > 0
                  AND LOWER(customer.status_user) = 'blacklist'
                 THEN (CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) - IFNULL(tp2.jml_bayar,0) - IFNULL(svu.total_voucher,0)
                 ELSE 0 END) AS total_blacklist
           ,COUNT(DISTINCT CASE 
                 WHEN LOWER(customer.status_user) = 'blacklist'
                  AND ((CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) - IFNULL(tp2.jml_bayar,0) - IFNULL(svu.total_voucher,0)) > 0
                 THEN customer.kode_customer
               END) AS num_blacklist_customer
    FROM transaksi t
      LEFT JOIN (
        SELECT kode_transaksi,
               SUM(IFNULL(jumlah_bayar,0) + IFNULL(voucher,0) + IFNULL(bayar_lain,0)) AS jml_bayar,
               MAX(tanggal_bayar) AS tanggal_bayar
        FROM transaksi_pembayaran
        WHERE (jenis_transaksi IS NULL OR UPPER(jenis_transaksi) <> 'PIUTANG')
        GROUP BY kode_transaksi
      ) tp2 ON tp2.kode_transaksi = t.kode_transaksi
      LEFT JOIN (
        SELECT kode_transaksi, SUM(voucher_use) AS total_voucher
        FROM sponsor_voucher_use
        GROUP BY kode_transaksi
      ) svu ON svu.kode_transaksi = t.kode_transaksi
      LEFT JOIN admin ON admin.id = t.id_marketing
      LEFT JOIN cabang_toko ON cabang_toko.id_cabang = t.id_cabang
      LEFT JOIN customer ON customer.kode_customer = t.kode_customer
    ${where}
    GROUP BY t.id_marketing, admin.nama_lengkap, t.id_cabang, cabang_toko.nama_cabang
    ORDER BY admin.nama_lengkap ASC, cabang_toko.nama_cabang ASC
  `
  const [rows] = await pool.query(sql, params)
  return { data: rows }
}

export async function fetchMarketingOverdueTransactions({ cabangId, marketingId, status, pembukuanId }) {
  const active = Number.isInteger(pembukuanId) ? await getActivePembukuan(pembukuanId) : null
  const params = []
  let where = 'WHERE 1=1'
  if (cabangId) { where += ' AND t.id_cabang = ?'; params.push(cabangId) }
  if (marketingId) { where += ' AND t.id_marketing = ?'; params.push(marketingId) }
  if (active) { where += ' AND t.tanggal_order BETWEEN ? AND ?'; params.push(active.tanggal_buka_buku, active.tanggal_tutup_buku) }
  const statusNorm = String(status || '').toLowerCase()
  if (statusNorm === 'blacklist') {
    where += " AND LOWER(customer.status_user) = 'blacklist'"
  } else if (statusNorm === 'nonblacklist') {
    where += " AND (customer.status_user IS NULL OR LOWER(customer.status_user) <> 'blacklist')"
  }

  const sql = `
    SELECT t.id_transaksi,
           t.kode_transaksi,
           t.tanggal_order,
           admin.nama_lengkap AS nama_marketing,
           cabang_toko.nama_cabang,
           customer.nama_customer,
           customer.kode_customer AS kode_customer,
           customer.status_user AS status_user,
           (CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) AS fix_harga,
           (
             SELECT SUM(IFNULL(jumlah_bayar,0))
             FROM transaksi_pembayaran pSum
             WHERE pSum.kode_transaksi = t.kode_transaksi
               AND (pSum.jenis_transaksi IS NULL OR UPPER(pSum.jenis_transaksi) <> 'PIUTANG')
           ) AS jml_bayar,
           (
             SELECT SUM(IFNULL(voucher_use,0))
             FROM sponsor_voucher_use vSum
             WHERE vSum.kode_transaksi = t.kode_transaksi
           ) AS total_voucher,
           (
             (CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) -
             IFNULL((
               SELECT SUM(IFNULL(jumlah_bayar,0))
               FROM transaksi_pembayaran pSum2
               WHERE pSum2.kode_transaksi = t.kode_transaksi
                 AND (pSum2.jenis_transaksi IS NULL OR UPPER(pSum2.jenis_transaksi) <> 'PIUTANG')
             ),0) -
             IFNULL((
               SELECT SUM(IFNULL(voucher_use,0))
               FROM sponsor_voucher_use vSum2
               WHERE vSum2.kode_transaksi = t.kode_transaksi
             ),0)
           ) AS sisa_bayar,
           (SELECT MAX(tanggal_bayar)
              FROM transaksi_pembayaran p
             WHERE (p.jenis_transaksi IS NULL OR UPPER(p.jenis_transaksi) <> 'PIUTANG')
               AND p.kode_transaksi = t.kode_transaksi
           ) AS last_bayar,
           (SELECT UPPER(p.jenis_transaksi)
              FROM transaksi_pembayaran p
             WHERE (p.jenis_transaksi IS NULL OR UPPER(p.jenis_transaksi) <> 'PIUTANG')
               AND p.kode_transaksi = t.kode_transaksi
             ORDER BY p.tanggal_bayar DESC, p.id_pembayaran DESC
             LIMIT 1
           ) AS last_jenis_transaksi,
           TIMESTAMPDIFF(MONTH, COALESCE((
             SELECT MAX(tanggal_bayar)
             FROM transaksi_pembayaran pMax
             WHERE pMax.kode_transaksi = t.kode_transaksi
               AND (pMax.jenis_transaksi IS NULL OR UPPER(pMax.jenis_transaksi) <> 'PIUTANG')
           ), t.tanggal_order), CURDATE()) AS umur_bulan
    FROM transaksi t
      
      LEFT JOIN admin ON admin.id = t.id_marketing
      LEFT JOIN cabang_toko ON cabang_toko.id_cabang = t.id_cabang
      LEFT JOIN customer ON customer.kode_customer = t.kode_customer
    ${where}
    HAVING sisa_bayar > 0
    ORDER BY t.tanggal_order ASC
  `
  const [rows] = await pool.query(sql, params)
  return { data: rows }
}

export async function fetchAsetReport({ cabangId }) {
  const now = Date.now()
  const cached = cabangId ? asetCache.single.get(cabangId) : null
  if (cached && (now - cached.ts) < ASET_CACHE_TTL_MS) {
    console.log(`[AsetCache] cabang=${cabangId} hit age=${now - cached.ts}ms`)
    return cached.data
  }
  if (!cabangId) return { data: [], summary: { total_aset: 0, estimasi_penjualan: 0, idle_3_bulan: 0, idle_6_bulan: 0, idle_1_tahun: 0, idle_gt_1_tahun: 0 } }
  console.log(`[Aset] START cabang=${cabangId}`)
  const params = [
    cabangId, cabangId, cabangId, cabangId,
    cabangId, cabangId, cabangId, cabangId,
    cabangId, cabangId, cabangId, cabangId,
    cabangId, cabangId, cabangId, cabangId,
  ]
  const sqlUnion = `
    SELECT 'katalog' AS jenis, p.id_produk AS id, p.nama_produk AS nama, p.sku_katalog AS sku,
           p.harga_modal, p.harga_jual, sc.stok AS stok,
           GREATEST(COALESCE(tl.last_log, '1970-01-01'), COALESCE(gl.last_log, '1970-01-01'), COALESCE(ord.last_order, '1970-01-01')) AS last_log
    FROM produk p
      JOIN produk_stok_cabang sc ON sc.id_produk=p.id_produk AND sc.id_cabang=?
      LEFT JOIN (
        SELECT tl.id_produk,
               COALESCE(tId.id_cabang, tKode.id_cabang, tl.id_cabang) AS id_cabang,
               MAX(tl.tanggal_log) AS last_log
        FROM transaksi_log tl
          LEFT JOIN transaksi tId ON tId.id_transaksi = tl.id_grosir
          LEFT JOIN transaksi tKode ON tKode.kode_transaksi = tl.id_grosir
        WHERE tl.jenis_produk='katalog' AND COALESCE(tId.id_cabang, tKode.id_cabang, tl.id_cabang)=?
        GROUP BY tl.id_produk, id_cabang
      ) tl ON tl.id_produk=p.id_produk AND tl.id_cabang=sc.id_cabang
      LEFT JOIN (
        SELECT gl.id_produk,
               g.id_cabang AS id_cabang,
               MAX(gl.tanggal_log) AS last_log
        FROM grosir_log gl
          LEFT JOIN grosir g ON g.kode_grosir = gl.id_grosir
        WHERE gl.jenis_produk='katalog' AND g.id_cabang=?
        GROUP BY gl.id_produk, g.id_cabang
      ) gl ON gl.id_produk=p.id_produk AND gl.id_cabang=sc.id_cabang
      LEFT JOIN (
        SELECT tb.id_produk, t.id_cabang AS id_cabang, MAX(t.tanggal_order) AS last_order
        FROM transaksi_barang tb JOIN transaksi t ON t.kode_transaksi = tb.kode_transaksi
        WHERE t.id_cabang = ?
        GROUP BY tb.id_produk, t.id_cabang
      ) ord ON ord.id_produk=p.id_produk AND ord.id_cabang=sc.id_cabang
    WHERE sc.stok > 0
    UNION ALL
    SELECT 'softlens' AS jenis, s.id_softlens AS id, s.nama_softlens AS nama, s.sku_softlens AS sku,
           s.harga_modal, s.harga_jual, ssc.stok AS stok,
           GREATEST(COALESCE(tl.last_log, '1970-01-01'), COALESCE(gl.last_log, '1970-01-01'), COALESCE(ord.last_order, '1970-01-01')) AS last_log
    FROM softlens s
      JOIN softlens_stok_cabang ssc ON ssc.id_softlens=s.id_softlens AND ssc.id_cabang=?
      LEFT JOIN (
        SELECT tl.id_produk,
               COALESCE(tId.id_cabang, tKode.id_cabang, tl.id_cabang) AS id_cabang,
               MAX(tl.tanggal_log) AS last_log
        FROM transaksi_log tl
          LEFT JOIN transaksi tId ON tId.id_transaksi = tl.id_grosir
          LEFT JOIN transaksi tKode ON tKode.kode_transaksi = tl.id_grosir
        WHERE tl.jenis_produk='softlens' AND COALESCE(tId.id_cabang, tKode.id_cabang, tl.id_cabang)=?
        GROUP BY tl.id_produk, id_cabang
      ) tl ON tl.id_produk=s.id_softlens AND tl.id_cabang=ssc.id_cabang
      LEFT JOIN (
        SELECT gl.id_produk,
               g.id_cabang AS id_cabang,
               MAX(gl.tanggal_log) AS last_log
        FROM grosir_log gl
          LEFT JOIN grosir g ON g.kode_grosir = gl.id_grosir
        WHERE gl.jenis_produk='softlens' AND g.id_cabang=?
        GROUP BY gl.id_produk, g.id_cabang
      ) gl ON gl.id_produk=s.id_softlens AND gl.id_cabang=ssc.id_cabang
      LEFT JOIN (
        SELECT tb.id_produk, t.id_cabang AS id_cabang, MAX(t.tanggal_order) AS last_order
        FROM transaksi_barang tb JOIN transaksi t ON t.kode_transaksi = tb.kode_transaksi
        WHERE t.id_cabang = ?
        GROUP BY tb.id_produk, t.id_cabang
      ) ord ON ord.id_produk=s.id_softlens AND ord.id_cabang=ssc.id_cabang
    WHERE ssc.stok > 0
    UNION ALL
    SELECT 'frame' AS jenis, f.id_frame AS id, (SELECT nama_frame FROM frame_kat WHERE frame_kat.id_kat_frame=f.id_kat_frame) AS nama, f.sku_frame AS sku,
           f.harga_modal, f.harga_jual, fsc.stok_cb AS stok,
           GREATEST(COALESCE(tl.last_log, '1970-01-01'), COALESCE(gl.last_log, '1970-01-01'), COALESCE(ord.last_order, '1970-01-01')) AS last_log
    FROM frame f
      JOIN frame_stok_cabang fsc ON fsc.id_frame=f.id_frame AND fsc.id_cabang=?
      LEFT JOIN (
        SELECT tl.id_produk,
               COALESCE(tId.id_cabang, tKode.id_cabang, tl.id_cabang) AS id_cabang,
               MAX(tl.tanggal_log) AS last_log
        FROM transaksi_log tl
          LEFT JOIN transaksi tId ON tId.id_transaksi = tl.id_grosir
          LEFT JOIN transaksi tKode ON tKode.kode_transaksi = tl.id_grosir
        WHERE tl.jenis_produk='frame' AND COALESCE(tId.id_cabang, tKode.id_cabang, tl.id_cabang)=?
        GROUP BY tl.id_produk, id_cabang
      ) tl ON tl.id_produk=f.id_frame AND tl.id_cabang=fsc.id_cabang
      LEFT JOIN (
        SELECT gl.id_produk,
               g.id_cabang AS id_cabang,
               MAX(gl.tanggal_log) AS last_log
        FROM grosir_log gl
          LEFT JOIN grosir g ON g.kode_grosir = gl.id_grosir
        WHERE gl.jenis_produk='frame' AND g.id_cabang=?
        GROUP BY gl.id_produk, g.id_cabang
      ) gl ON gl.id_produk=f.id_frame AND gl.id_cabang=fsc.id_cabang
      LEFT JOIN (
        SELECT tf.id_frame AS id_produk, t.id_cabang AS id_cabang, MAX(t.tanggal_order) AS last_order
        FROM transaksi_frame tf JOIN transaksi t ON t.kode_transaksi = tf.kode_transaksi
        WHERE t.id_cabang = ?
        GROUP BY tf.id_frame, t.id_cabang
      ) ord ON ord.id_produk=f.id_frame AND ord.id_cabang=fsc.id_cabang
    WHERE fsc.stok_cb > 0
    UNION ALL
    SELECT 'lensa' AS jenis, l.id_lensa AS id, CONCAT((SELECT nama_lensa_kat FROM lensa_kat WHERE lensa_kat.id_lensa_kat=l.id_lensa_kat),' ', l.size) AS nama, l.sku_lensa AS sku,
           l.harga_modal, l.harga_jual, lsc.stok_masuk AS stok,
           GREATEST(COALESCE(tl.last_log, '1970-01-01'), COALESCE(gl.last_log, '1970-01-01'), COALESCE(ord.last_order, '1970-01-01')) AS last_log
    FROM lensa l
      JOIN lensa_stok_cabang lsc ON lsc.id_lensa=l.id_lensa AND lsc.id_cabang=?
      LEFT JOIN (
        SELECT tl.id_produk,
               COALESCE(tId.id_cabang, tKode.id_cabang, tl.id_cabang) AS id_cabang,
               MAX(tl.tanggal_log) AS last_log
        FROM transaksi_log tl
          LEFT JOIN transaksi tId ON tId.id_transaksi = tl.id_grosir
          LEFT JOIN transaksi tKode ON tKode.kode_transaksi = tl.id_grosir
        WHERE tl.jenis_produk='lensa' AND COALESCE(tId.id_cabang, tKode.id_cabang, tl.id_cabang)=?
        GROUP BY tl.id_produk, id_cabang
      ) tl ON tl.id_produk=l.id_lensa AND tl.id_cabang=lsc.id_cabang
      LEFT JOIN (
        SELECT gl.id_produk,
               g.id_cabang AS id_cabang,
               MAX(gl.tanggal_log) AS last_log
        FROM grosir_log gl
          LEFT JOIN grosir g ON g.kode_grosir = gl.id_grosir
        WHERE gl.jenis_produk='lensa' AND g.id_cabang=?
        GROUP BY gl.id_produk, g.id_cabang
      ) gl ON gl.id_produk=l.id_lensa AND gl.id_cabang=lsc.id_cabang
      LEFT JOIN (
        SELECT tl2.id_lensa AS id_produk, t.id_cabang AS id_cabang, MAX(t.tanggal_order) AS last_order
        FROM transaksi_lensa tl2 JOIN transaksi t ON t.kode_transaksi = tl2.kode_transaksi
        WHERE t.id_cabang = ?
        GROUP BY tl2.id_lensa, t.id_cabang
      ) ord ON ord.id_produk=l.id_lensa AND ord.id_cabang=lsc.id_cabang
    WHERE lsc.stok_masuk > 0
  `
  const sql = `
    SELECT u.*, TIMESTAMPDIFF(MONTH, u.last_log, CURDATE()) AS months_since_log
    FROM ( ${sqlUnion} ) u
  `
  const t0 = Date.now()
  let rows = []
  try {
    const q = await pool.query({ sql, values: params, timeout: 20000 })
    rows = q?.[0] || []
  } catch (e) {
    console.warn(`[Aset] ERROR cabang=${cabangId} ${e?.code || ''} ${e?.message || e}`)
    // fallback: summary ringan tanpa idle
    const sumSql = `
      SELECT SUM(total_aset) AS total_aset, SUM(est) AS estimasi_penjualan
      FROM (
        SELECT SUM(p.harga_modal * sc.stok) AS total_aset, SUM(p.harga_jual * sc.stok) AS est
        FROM produk_stok_cabang sc JOIN produk p ON p.id_produk=sc.id_produk
        WHERE sc.id_cabang=?
        UNION ALL
        SELECT SUM(s.harga_modal * ssc.stok) AS total_aset, SUM(s.harga_jual * ssc.stok) AS est
        FROM softlens_stok_cabang ssc JOIN softlens s ON s.id_softlens=ssc.id_softlens
        WHERE ssc.id_cabang=?
        UNION ALL
        SELECT SUM(f.harga_modal * fsc.stok_cb) AS total_aset, SUM(f.harga_jual * fsc.stok_cb) AS est
        FROM frame_stok_cabang fsc JOIN frame f ON f.id_frame=fsc.id_frame
        WHERE fsc.id_cabang=?
        UNION ALL
        SELECT SUM(l.harga_modal * lsc.stok_masuk) AS total_aset, SUM(l.harga_jual * lsc.stok_masuk) AS est
        FROM lensa_stok_cabang lsc JOIN lensa l ON l.id_lensa=lsc.id_lensa
        WHERE lsc.id_cabang=?
      ) s
    `
    const [sumRows] = await pool.query({ sql: sumSql, values: [cabangId, cabangId, cabangId, cabangId], timeout: 15000 })
    const summary = {
      total_aset: Number(sumRows?.[0]?.total_aset || 0),
      estimasi_penjualan: Number(sumRows?.[0]?.estimasi_penjualan || 0),
      idle_3_bulan: 0, idle_6_bulan: 0, idle_1_tahun: 0, idle_gt_1_tahun: 0
    }
    const result = { data: [], summary }
    asetCache.single.set(cabangId, { ts: Date.now(), data: result })
    return result
  }
  const dur = Date.now() - t0
  const warn = dur > 5000 || rows.length > 50000
  const msg = `[Aset] cabang=${cabangId} rows=${rows.length} ms=${dur}`
  if (warn) console.warn(msg)
  else console.log(msg)
  try {
    const byJenis = new Map()
    for (const r of rows) {
      const k = r.jenis
      if (!byJenis.has(k)) byJenis.set(k, new Set())
      byJenis.get(k).add(Number(r.id))
    }
    for (const [jenis, idSet] of byJenis.entries()) {
      const ids = Array.from(idSet)
      const map = await fetchLastOrderDates({ jenis, cabangId, ids })
      for (const r of rows) {
        if (r.jenis === jenis) {
          const d = map.get(Number(r.id))
          if (d && (!r.last_log || new Date(d) > new Date(r.last_log))) r.last_log = d
        }
      }
    }
    for (const r of rows) {
      const d = r.last_log
      if (d) {
        const now = new Date()
        const x = new Date(d)
        const m = (now.getFullYear() - x.getFullYear()) * 12 + (now.getMonth() - x.getMonth())
        r.months_since_log = m
      }
    }
  } catch { }
  const summary = rows.reduce((acc, r) => {
    const aset = Number(r.harga_modal || 0) * Number(r.stok || 0)
    const est = Number(r.harga_jual || 0) * Number(r.stok || 0)
    acc.total_aset += aset
    acc.estimasi_penjualan += est
    const months = Number(r.months_since_log ?? 999)
    if (months >= 3 && months < 6) acc.idle_3_bulan += aset
    else if (months >= 6 && months < 12) acc.idle_6_bulan += aset
    else if (months >= 12 && months < 24) acc.idle_1_tahun += aset
    else if (months >= 24) acc.idle_gt_1_tahun += aset
    return acc
  }, { total_aset: 0, estimasi_penjualan: 0, idle_3_bulan: 0, idle_6_bulan: 0, idle_1_tahun: 0, idle_gt_1_tahun: 0 })
  let result = { data: rows, summary }
  try {
    const jenisList = Array.from(new Set(rows.map(r => r.jenis)))
    const idList = Array.from(new Set(rows.map(r => Number(r.id))))
    if (jenisList.length && idList.length) {
      const jenisPlace = jenisList.map(() => '?').join(',')
      const idPlace = idList.map(() => '?').join(',')
      const [stRows] = await pool.query(`SELECT jenis, product_id, status FROM asset_status WHERE jenis IN (${jenisPlace}) AND product_id IN (${idPlace})`, [...jenisList, ...idList])
      const map = new Map(stRows.map(s => [`${s.jenis}:${s.product_id}`, Number(s.status || 1)]))
      const merged = rows.map(r => ({ ...r, status: map.get(`${r.jenis}:${Number(r.id)}`) ?? 1 }))
      result = { data: merged.filter(r => Number(r.status || 1) === 1), summary }
    }
  } catch { }
  if (cabangId) asetCache.single.set(cabangId, { ts: Date.now(), data: result })
  return result
}

async function fetchLastOrderDates({ jenis, cabangId, ids }) {
  if (!Array.isArray(ids) || !ids.length) return new Map()
  const idPlace = ids.map(() => '?').join(',')
  const vals = [...ids, cabangId]
  let tokoSql = ''
  if (jenis === 'frame') {
    tokoSql = `SELECT tf.id_frame AS id_produk, MAX(t.tanggal_order) AS last_order FROM transaksi_frame tf JOIN transaksi t ON t.kode_transaksi = tf.kode_transaksi WHERE tf.id_frame IN (${idPlace}) AND t.id_cabang = ? GROUP BY tf.id_frame`
  } else if (jenis === 'lensa') {
    tokoSql = `SELECT tl2.id_lensa AS id_produk, MAX(t.tanggal_order) AS last_order FROM transaksi_lensa tl2 JOIN transaksi t ON t.kode_transaksi = tl2.kode_transaksi WHERE tl2.id_lensa IN (${idPlace}) AND t.id_cabang = ? GROUP BY tl2.id_lensa`
  } else {
    tokoSql = `SELECT tb.id_produk AS id_produk, MAX(t.tanggal_order) AS last_order FROM transaksi_barang tb JOIN transaksi t ON t.kode_transaksi = tb.kode_transaksi WHERE tb.id_produk IN (${idPlace}) AND t.id_cabang = ? GROUP BY tb.id_produk`
  }
  const [tokoRows] = await pool.query({ sql: tokoSql, values: vals, timeout: 20000 })
  const [tlRowsDirect] = await pool.query({ sql: `SELECT tl.id_produk AS id_produk, MAX(tl.tanggal_log) AS last_log FROM transaksi_log tl WHERE tl.jenis_produk=? AND tl.id_produk IN (${idPlace}) AND tl.id_cabang=? GROUP BY tl.id_produk`, values: [jenis, ...ids, cabangId], timeout: 20000 })
  const [tlRowsId] = await pool.query({ sql: `SELECT tl.id_produk AS id_produk, MAX(tl.tanggal_log) AS last_log FROM transaksi_log tl JOIN transaksi t ON t.id_transaksi = tl.id_grosir WHERE tl.jenis_produk=? AND tl.id_produk IN (${idPlace}) AND t.id_cabang=? GROUP BY tl.id_produk`, values: [jenis, ...ids, cabangId], timeout: 20000 })
  const [tlRowsKode] = await pool.query({ sql: `SELECT tl.id_produk AS id_produk, MAX(tl.tanggal_log) AS last_log FROM transaksi_log tl JOIN transaksi t ON t.kode_transaksi = tl.id_grosir WHERE tl.jenis_produk=? AND tl.id_produk IN (${idPlace}) AND t.id_cabang=? GROUP BY tl.id_produk`, values: [jenis, ...ids, cabangId], timeout: 20000 })
  const [grosirRows] = await pool.query({ sql: `SELECT gl.id_produk AS id_produk, MAX(gl.tanggal_log) AS last_log FROM grosir_log gl JOIN grosir g ON g.kode_grosir = gl.id_grosir WHERE gl.jenis_produk=? AND gl.id_produk IN (${idPlace}) AND g.id_cabang=? GROUP BY gl.id_produk`, values: [jenis, ...ids, cabangId], timeout: 20000 })
  const map = new Map()
  function setMax(id, dateStr) { if (!dateStr) return; const prev = map.get(id); if (!prev || new Date(dateStr) > new Date(prev)) map.set(id, dateStr) }
  for (const r of tokoRows) { setMax(Number(r.id_produk), r.last_order) }
  for (const r of tlRowsDirect) { setMax(Number(r.id_produk), r.last_log) }
  for (const r of tlRowsId) { setMax(Number(r.id_produk), r.last_log) }
  for (const r of tlRowsKode) { setMax(Number(r.id_produk), r.last_log) }
  for (const r of grosirRows) { setMax(Number(r.id_produk), r.last_log) }
  return map
}

export async function fetchAsetReportLight({ cabangId }) {
  if (!cabangId) return { data: [], summary: { total_aset: 0, estimasi_penjualan: 0, idle_3_bulan: 0, idle_6_bulan: 0, idle_1_tahun: 0, idle_gt_1_tahun: 0 } }
  const sqlSummaryUnion = `
    SELECT SUM(total_aset) AS total_aset, SUM(est) AS estimasi_penjualan
    FROM (
      SELECT SUM(p.harga_modal * sc.stok) AS total_aset, SUM(p.harga_jual * sc.stok) AS est
      FROM produk_stok_cabang sc JOIN produk p ON p.id_produk = sc.id_produk
      LEFT JOIN asset_status ast ON ast.jenis='katalog' AND ast.product_id=p.id_produk
      WHERE sc.id_cabang = ? AND COALESCE(ast.status,1) = 1
      UNION ALL
      SELECT SUM(s.harga_modal * ssc.stok) AS total_aset, SUM(s.harga_jual * ssc.stok) AS est
      FROM softlens_stok_cabang ssc JOIN softlens s ON s.id_softlens = ssc.id_softlens
      LEFT JOIN asset_status ast ON ast.jenis='softlens' AND ast.product_id=s.id_softlens
      WHERE ssc.id_cabang = ? AND COALESCE(ast.status,1) = 1
      UNION ALL
      SELECT SUM(f.harga_modal * fsc.stok_cb) AS total_aset, SUM(f.harga_jual * fsc.stok_cb) AS est
      FROM frame_stok_cabang fsc JOIN frame f ON f.id_frame = fsc.id_frame
      LEFT JOIN asset_status ast ON ast.jenis='frame' AND ast.product_id=f.id_frame
      WHERE fsc.id_cabang = ? AND COALESCE(ast.status,1) = 1
      UNION ALL
      SELECT SUM(l.harga_modal * lsc.stok_masuk) AS total_aset, SUM(l.harga_jual * lsc.stok_masuk) AS est
      FROM lensa_stok_cabang lsc JOIN lensa l ON l.id_lensa = lsc.id_lensa
      LEFT JOIN asset_status ast ON ast.jenis='lensa' AND ast.product_id=l.id_lensa
      WHERE lsc.id_cabang = ? AND COALESCE(ast.status,1) = 1
    ) s`
  const t0 = Date.now()
  const [sumRows] = await pool.query({ sql: sqlSummaryUnion, values: [cabangId, cabangId, cabangId, cabangId], timeout: 15000 })
  const dur = Date.now() - t0
  const msg = `[AsetLight] cabang=${cabangId} ms=${dur}`
  console.log(msg)
  const summary = {
    total_aset: Number(sumRows?.[0]?.total_aset || 0),
    estimasi_penjualan: Number(sumRows?.[0]?.estimasi_penjualan || 0),
    idle_3_bulan: 0, idle_6_bulan: 0, idle_1_tahun: 0, idle_gt_1_tahun: 0
  }
  return { data: [], summary }
}

export async function fetchAsetReportAllCabang({ includeIdle = false, months } = {}) {
  const now = Date.now()
  if (asetCache.all.data && asetCache.all.includeIdle === includeIdle && (now - asetCache.all.ts) < ASET_CACHE_TTL_MS) {
    console.log(`[AsetCacheAll] hit idle=${includeIdle} age=${now - asetCache.all.ts}ms`)
    return asetCache.all.data
  }
  console.log(`[AsetAll] START idle=${includeIdle}`)
  if (!includeIdle) {
    const sqlSummaryUnion = `
      SELECT id_cabang, nama_cabang,
             SUM(total_aset) AS total_aset,
             SUM(est) AS estimasi_penjualan,
             0 AS idle_3_bulan,
             0 AS idle_6_bulan,
             0 AS idle_1_tahun,
             0 AS idle_gt_1_tahun
      FROM (
        SELECT sc.id_cabang, (SELECT nama_cabang FROM cabang_toko WHERE id_cabang=sc.id_cabang) AS nama_cabang,
               SUM(p.harga_modal * sc.stok) AS total_aset,
               SUM(p.harga_jual * sc.stok) AS est
        FROM produk_stok_cabang sc
          JOIN produk p ON p.id_produk = sc.id_produk
          LEFT JOIN asset_status ast ON ast.jenis='katalog' AND ast.product_id=p.id_produk
        WHERE COALESCE(ast.status,1) = 1
        GROUP BY sc.id_cabang
        UNION ALL
        SELECT ssc.id_cabang, (SELECT nama_cabang FROM cabang_toko WHERE id_cabang=ssc.id_cabang) AS nama_cabang,
               SUM(s.harga_modal * ssc.stok) AS total_aset,
               SUM(s.harga_jual * ssc.stok) AS est
        FROM softlens_stok_cabang ssc
          JOIN softlens s ON s.id_softlens = ssc.id_softlens
          LEFT JOIN asset_status ast ON ast.jenis='softlens' AND ast.product_id=s.id_softlens
        WHERE COALESCE(ast.status,1) = 1
        GROUP BY ssc.id_cabang
        UNION ALL
        SELECT fsc.id_cabang, (SELECT nama_cabang FROM cabang_toko WHERE id_cabang=fsc.id_cabang) AS nama_cabang,
               SUM(f.harga_modal * fsc.stok_cb) AS total_aset,
               SUM(f.harga_jual * fsc.stok_cb) AS est
        FROM frame_stok_cabang fsc
          JOIN frame f ON f.id_frame = fsc.id_frame
          LEFT JOIN asset_status ast ON ast.jenis='frame' AND ast.product_id=f.id_frame
        WHERE COALESCE(ast.status,1) = 1
        GROUP BY fsc.id_cabang
        UNION ALL
        SELECT lsc.id_cabang, (SELECT nama_cabang FROM cabang_toko WHERE id_cabang=lsc.id_cabang) AS nama_cabang,
               SUM(l.harga_modal * lsc.stok_masuk) AS total_aset,
               SUM(l.harga_jual * lsc.stok_masuk) AS est
        FROM lensa_stok_cabang lsc
          JOIN lensa l ON l.id_lensa = lsc.id_lensa
          LEFT JOIN asset_status ast ON ast.jenis='lensa' AND ast.product_id=l.id_lensa
        WHERE COALESCE(ast.status,1) = 1
        GROUP BY lsc.id_cabang
      ) s
      GROUP BY id_cabang, nama_cabang
      ORDER BY nama_cabang
    `
    const t0 = Date.now()
    const [rows] = await pool.query({ sql: sqlSummaryUnion, timeout: 120000 })
    const dur = Date.now() - t0
    const msg = `[AsetAllSummary] rows=${rows.length} ms=${dur}`
    console.log(msg)
    const summary = rows.reduce((acc, s) => {
      acc.total_aset += Number(s.total_aset || 0)
      acc.estimasi_penjualan += Number(s.estimasi_penjualan || 0)
      return acc
    }, { total_aset: 0, estimasi_penjualan: 0, idle_3_bulan: 0, idle_6_bulan: 0, idle_1_tahun: 0, idle_gt_1_tahun: 0 })
    const result = { list: rows, summary }
    asetCache.all = { ts: Date.now(), includeIdle, data: result }
    return result
  }

  const lookback = Math.max(1, Number(months || 24))
  const sqlUnion = `
    SELECT 'katalog' AS jenis,
           sc.id_cabang,
           (SELECT nama_cabang FROM cabang_toko WHERE id_cabang = sc.id_cabang) AS nama_cabang,
           p.harga_modal, p.harga_jual, sc.stok AS stok,
           GREATEST(COALESCE(tl.last_log, '1970-01-01'), COALESCE(gl.last_log, '1970-01-01'), COALESCE(ord.last_order, '1970-01-01')) AS last_log
    FROM produk p
      JOIN produk_stok_cabang sc ON sc.id_produk=p.id_produk
      LEFT JOIN asset_status ast ON ast.jenis='katalog' AND ast.product_id=p.id_produk
      LEFT JOIN (
        SELECT tl.id_produk,
               COALESCE(tId.id_cabang, tKode.id_cabang, tl.id_cabang) AS id_cabang,
               MAX(tl.tanggal_log) AS last_log
        FROM transaksi_log tl
          LEFT JOIN transaksi tId ON tId.id_transaksi = tl.id_grosir
          LEFT JOIN transaksi tKode ON tKode.kode_transaksi = tl.id_grosir
        WHERE tl.jenis_produk='katalog'
        GROUP BY tl.id_produk, id_cabang
      ) tl ON tl.id_produk=p.id_produk AND tl.id_cabang=sc.id_cabang
      LEFT JOIN (
        SELECT gl.id_produk,
               gl.id_cabang AS id_cabang,
               MAX(gl.tanggal_log) AS last_log
        FROM grosir_log gl
        WHERE gl.jenis_produk='katalog'
        GROUP BY gl.id_produk, gl.id_cabang
      ) gl ON gl.id_produk=p.id_produk AND gl.id_cabang=sc.id_cabang
      LEFT JOIN (
        SELECT tb.id_produk, t.id_cabang AS id_cabang, MAX(t.tanggal_order) AS last_order
        FROM transaksi_barang tb JOIN transaksi t ON t.kode_transaksi = tb.kode_transaksi
        GROUP BY tb.id_produk, t.id_cabang
      ) ord ON ord.id_produk=p.id_produk AND ord.id_cabang=sc.id_cabang
    WHERE sc.stok > 0 AND COALESCE(ast.status,1) = 1
    UNION ALL
    SELECT 'softlens' AS jenis,
           ssc.id_cabang,
           (SELECT nama_cabang FROM cabang_toko WHERE id_cabang = ssc.id_cabang) AS nama_cabang,
           s.harga_modal, s.harga_jual, ssc.stok AS stok,
           GREATEST(COALESCE(tl.last_log, '1970-01-01'), COALESCE(gl.last_log, '1970-01-01'), COALESCE(ord.last_order, '1970-01-01')) AS last_log
    FROM softlens s
      JOIN softlens_stok_cabang ssc ON ssc.id_softlens=s.id_softlens
      LEFT JOIN asset_status ast ON ast.jenis='softlens' AND ast.product_id=s.id_softlens
      LEFT JOIN (
        SELECT tl.id_produk,
               COALESCE(tId.id_cabang, tKode.id_cabang, tl.id_cabang) AS id_cabang,
               MAX(tl.tanggal_log) AS last_log
        FROM transaksi_log tl
          LEFT JOIN transaksi tId ON tId.id_transaksi = tl.id_grosir
          LEFT JOIN transaksi tKode ON tKode.kode_transaksi = tl.id_grosir
        WHERE tl.jenis_produk='softlens'
        GROUP BY tl.id_produk, id_cabang
      ) tl ON tl.id_produk=s.id_softlens AND tl.id_cabang=ssc.id_cabang
      LEFT JOIN (
        SELECT gl.id_produk,
               gl.id_cabang AS id_cabang,
               MAX(gl.tanggal_log) AS last_log
        FROM grosir_log gl
        WHERE gl.jenis_produk='softlens'
        GROUP BY gl.id_produk, gl.id_cabang
      ) gl ON gl.id_produk=s.id_softlens AND gl.id_cabang=ssc.id_cabang
      LEFT JOIN (
        SELECT tb.id_produk, t.id_cabang AS id_cabang, MAX(t.tanggal_order) AS last_order
        FROM transaksi_barang tb JOIN transaksi t ON t.kode_transaksi = tb.kode_transaksi
        GROUP BY tb.id_produk, t.id_cabang
      ) ord ON ord.id_produk=s.id_softlens AND ord.id_cabang=ssc.id_cabang
    WHERE ssc.stok > 0 AND COALESCE(ast.status,1) = 1
    UNION ALL
    SELECT 'frame' AS jenis,
           fsc.id_cabang,
           (SELECT nama_cabang FROM cabang_toko WHERE id_cabang = fsc.id_cabang) AS nama_cabang,
           f.harga_modal, f.harga_jual, fsc.stok_cb AS stok,
           GREATEST(COALESCE(tl.last_log, '1970-01-01'), COALESCE(gl.last_log, '1970-01-01'), COALESCE(ord.last_order, '1970-01-01')) AS last_log
    FROM frame f
      JOIN frame_stok_cabang fsc ON fsc.id_frame=f.id_frame
      LEFT JOIN asset_status ast ON ast.jenis='frame' AND ast.product_id=f.id_frame
      LEFT JOIN (
        SELECT tl.id_produk,
               COALESCE(tId.id_cabang, tKode.id_cabang, tl.id_cabang) AS id_cabang,
               MAX(tl.tanggal_log) AS last_log
        FROM transaksi_log tl
          LEFT JOIN transaksi tId ON tId.id_transaksi = tl.id_grosir
          LEFT JOIN transaksi tKode ON tKode.kode_transaksi = tl.id_grosir
        WHERE tl.jenis_produk='frame'
        GROUP BY tl.id_produk, id_cabang
      ) tl ON tl.id_produk=f.id_frame AND tl.id_cabang=fsc.id_cabang
      LEFT JOIN (
        SELECT gl.id_produk,
               gl.id_cabang AS id_cabang,
               MAX(gl.tanggal_log) AS last_log
        FROM grosir_log gl
        WHERE gl.jenis_produk='frame'
        GROUP BY gl.id_produk, gl.id_cabang
      ) gl ON gl.id_produk=f.id_frame AND gl.id_cabang=fsc.id_cabang
      LEFT JOIN (
        SELECT tf.id_frame AS id_produk, t.id_cabang AS id_cabang, MAX(t.tanggal_order) AS last_order
        FROM transaksi_frame tf JOIN transaksi t ON t.kode_transaksi = tf.kode_transaksi
        GROUP BY tf.id_frame, t.id_cabang
      ) ord ON ord.id_produk=f.id_frame AND ord.id_cabang=fsc.id_cabang
    WHERE fsc.stok_cb > 0 AND COALESCE(ast.status,1) = 1
    UNION ALL
    SELECT 'lensa' AS jenis,
           lsc.id_cabang,
           (SELECT nama_cabang FROM cabang_toko WHERE id_cabang = lsc.id_cabang) AS nama_cabang,
           l.harga_modal, l.harga_jual, lsc.stok_masuk AS stok,
           GREATEST(COALESCE(tl.last_log, '1970-01-01'), COALESCE(gl.last_log, '1970-01-01'), COALESCE(ord.last_order, '1970-01-01')) AS last_log
    FROM lensa l
      JOIN lensa_stok_cabang lsc ON lsc.id_lensa=l.id_lensa
      LEFT JOIN asset_status ast ON ast.jenis='lensa' AND ast.product_id=l.id_lensa
      LEFT JOIN (
        SELECT tl.id_produk,
               COALESCE(tId.id_cabang, tKode.id_cabang, tl.id_cabang) AS id_cabang,
               MAX(tl.tanggal_log) AS last_log
        FROM transaksi_log tl
          LEFT JOIN transaksi tId ON tId.id_transaksi = tl.id_grosir
          LEFT JOIN transaksi tKode ON tKode.kode_transaksi = tl.id_grosir
        WHERE tl.jenis_produk='lensa'
        GROUP BY tl.id_produk, id_cabang
      ) tl ON tl.id_produk=l.id_lensa AND tl.id_cabang=lsc.id_cabang
      LEFT JOIN (
        SELECT gl.id_produk,
               gl.id_cabang AS id_cabang,
               MAX(gl.tanggal_log) AS last_log
        FROM grosir_log gl
        WHERE gl.jenis_produk='lensa'
        GROUP BY gl.id_produk, gl.id_cabang
      ) gl ON gl.id_produk=l.id_lensa AND gl.id_cabang=lsc.id_cabang
      LEFT JOIN (
        SELECT tl2.id_lensa AS id_produk, t.id_cabang AS id_cabang, MAX(t.tanggal_order) AS last_order
        FROM transaksi_lensa tl2 JOIN transaksi t ON t.kode_transaksi = tl2.kode_transaksi
        GROUP BY tl2.id_lensa, t.id_cabang
      ) ord ON ord.id_produk=l.id_lensa AND ord.id_cabang=lsc.id_cabang
    WHERE lsc.stok_masuk > 0 AND COALESCE(ast.status,1) = 1
  `
  const sql = `
    SELECT id_cabang, nama_cabang,
           SUM(harga_modal*stok) AS total_aset,
           SUM(harga_jual*stok) AS estimasi_penjualan,
           SUM(CASE WHEN TIMESTAMPDIFF(MONTH, DATE(last_log), CURDATE()) >= 3 THEN harga_modal*stok ELSE 0 END) AS idle_3_bulan,
           SUM(CASE WHEN TIMESTAMPDIFF(MONTH, DATE(last_log), CURDATE()) >= 6 THEN harga_modal*stok ELSE 0 END) AS idle_6_bulan,
           SUM(CASE WHEN TIMESTAMPDIFF(MONTH, DATE(last_log), CURDATE()) >= 12 THEN harga_modal*stok ELSE 0 END) AS idle_1_tahun,
           SUM(CASE WHEN TIMESTAMPDIFF(MONTH, DATE(last_log), CURDATE()) >= 24 THEN harga_modal*stok ELSE 0 END) AS idle_gt_1_tahun
    FROM ( ${sqlUnion} ) u
    WHERE id_cabang IS NOT NULL
    GROUP BY id_cabang, nama_cabang
    ORDER BY nama_cabang
  `
  const t0 = Date.now()
  const [rows] = await pool.query({ sql, timeout: 120000 })
  const dur = Date.now() - t0
  const warn = dur > 8000 || rows.length > 1000
  const msg = `[AsetAll] rows=${rows.length} ms=${dur}`
  if (warn) console.warn(msg)
  else console.log(msg)
  const summary = rows.reduce((acc, s) => {
    acc.total_aset += Number(s.total_aset || 0)
    acc.estimasi_penjualan += Number(s.estimasi_penjualan || 0)
    acc.idle_3_bulan += Number(s.idle_3_bulan || 0)
    acc.idle_6_bulan += Number(s.idle_6_bulan || 0)
    acc.idle_1_tahun += Number(s.idle_1_tahun || 0)
    acc.idle_gt_1_tahun += Number(s.idle_gt_1_tahun || 0)
    return acc
  }, { total_aset: 0, estimasi_penjualan: 0, idle_3_bulan: 0, idle_6_bulan: 0, idle_1_tahun: 0, idle_gt_1_tahun: 0 })
  const result = { list: rows, summary }
  asetCache.all = { ts: Date.now(), includeIdle, data: result }
  return result
}

export async function fetchAsetIdle({ cabangId, months = 3, includeAllHistory = false, historyMonths }) {
  if (!cabangId) return { data: [], summary: { total_aset: 0 } }
  const key = `${cabangId}:${months}`
  const now = Date.now()
  const cached = asetCache.idle.get(key)
  if (cached && (now - cached.ts) < ASET_CACHE_TTL_MS) {
    console.log(`[AsetIdleCache] cabang=${cabangId} months=${months} hit age=${now - cached.ts}ms`)
    return cached.data
  }
  const params = [
    cabangId, cabangId, cabangId, cabangId,
    months
  ]
  const sqlUnion = `
    SELECT 'katalog' AS jenis, p.id_produk AS id, p.nama_produk AS nama, p.sku_katalog AS sku,
           p.harga_modal, p.harga_jual, sc.stok AS stok,
           GREATEST(
             COALESCE(tl.last_log, '1970-01-01'),
             COALESCE(gl.last_log, '1970-01-01'),
             COALESCE(ord.last_order, '1970-01-01')
           ) AS last_log
    FROM produk p
      JOIN produk_stok_cabang sc ON sc.id_produk=p.id_produk AND sc.id_cabang=?
      LEFT JOIN (
        SELECT tl.id_produk,
               COALESCE(tId.id_cabang, tKode.id_cabang, tl.id_cabang) AS id_cabang,
               MAX(tl.tanggal_log) AS last_log
        FROM transaksi_log tl
          LEFT JOIN transaksi tId ON tId.id_transaksi = tl.id_grosir
          LEFT JOIN transaksi tKode ON tKode.kode_transaksi = tl.id_grosir
        WHERE tl.jenis_produk='katalog'
        GROUP BY tl.id_produk, COALESCE(tId.id_cabang, tKode.id_cabang, tl.id_cabang)
      ) tl ON tl.id_produk=p.id_produk AND tl.id_cabang=sc.id_cabang
      LEFT JOIN (
        SELECT gl.id_produk,
               g.id_cabang AS id_cabang,
               MAX(gl.tanggal_log) AS last_log
        FROM grosir_log gl
          LEFT JOIN grosir g ON g.kode_grosir = gl.id_grosir
        WHERE gl.jenis_produk='katalog'
        GROUP BY gl.id_produk, g.id_cabang
      ) gl ON gl.id_produk=p.id_produk AND gl.id_cabang=sc.id_cabang
      LEFT JOIN (
        SELECT tb.id_produk, t.id_cabang AS id_cabang, MAX(t.tanggal_order) AS last_order
        FROM transaksi_barang tb JOIN transaksi t ON t.kode_transaksi = tb.kode_transaksi
        GROUP BY tb.id_produk, t.id_cabang
      ) ord ON ord.id_produk=p.id_produk AND ord.id_cabang=sc.id_cabang
    WHERE sc.stok > 0
    UNION ALL
    SELECT 'softlens' AS jenis, s.id_softlens AS id, s.nama_softlens AS nama, s.sku_softlens AS sku,
           s.harga_modal, s.harga_jual, ssc.stok AS stok,
           GREATEST(
             COALESCE(tl.last_log, '1970-01-01'),
             COALESCE(gl.last_log, '1970-01-01'),
             COALESCE(ord.last_order, '1970-01-01')
           ) AS last_log
    FROM softlens s
      JOIN softlens_stok_cabang ssc ON ssc.id_softlens=s.id_softlens AND ssc.id_cabang=?
      LEFT JOIN (
        SELECT tl.id_produk,
               COALESCE(tId.id_cabang, tKode.id_cabang, tl.id_cabang) AS id_cabang,
               MAX(tl.tanggal_log) AS last_log
        FROM transaksi_log tl
          LEFT JOIN transaksi tId ON tId.id_transaksi = tl.id_grosir
          LEFT JOIN transaksi tKode ON tKode.kode_transaksi = tl.id_grosir
        WHERE tl.jenis_produk='softlens'
        GROUP BY tl.id_produk, COALESCE(tId.id_cabang, tKode.id_cabang, tl.id_cabang)
      ) tl ON tl.id_produk=s.id_softlens AND tl.id_cabang=ssc.id_cabang
      LEFT JOIN (
        SELECT gl.id_produk,
               gl.id_cabang AS id_cabang,
               MAX(gl.tanggal_log) AS last_log
        FROM grosir_log gl
        WHERE gl.jenis_produk='softlens'
        GROUP BY gl.id_produk, gl.id_cabang
      ) gl ON gl.id_produk=s.id_softlens AND gl.id_cabang=ssc.id_cabang
      LEFT JOIN (
        SELECT tb.id_produk, t.id_cabang AS id_cabang, MAX(t.tanggal_order) AS last_order
        FROM transaksi_barang tb JOIN transaksi t ON t.kode_transaksi = tb.kode_transaksi
        GROUP BY tb.id_produk, t.id_cabang
      ) ord ON ord.id_produk=s.id_softlens AND ord.id_cabang=ssc.id_cabang
    WHERE ssc.stok > 0
    UNION ALL
    SELECT 'frame' AS jenis, f.id_frame AS id, (SELECT nama_frame FROM frame_kat WHERE frame_kat.id_kat_frame=f.id_kat_frame) AS nama, f.sku_frame AS sku,
           f.harga_modal, f.harga_jual, fsc.stok_cb AS stok,
           GREATEST(
             COALESCE(tl.last_log, '1970-01-01'),
             COALESCE(gl.last_log, '1970-01-01'),
             COALESCE(ord.last_order, '1970-01-01'),
             COALESCE(tls.last_log, '1970-01-01'),
             COALESCE(gls.last_log, '1970-01-01')
           ) AS last_log
    FROM frame f
      JOIN frame_stok_cabang fsc ON fsc.id_frame=f.id_frame AND fsc.id_cabang=?
      LEFT JOIN (
        SELECT tl.id_produk,
               COALESCE(tId.id_cabang, tKode.id_cabang, tl.id_cabang) AS id_cabang,
               MAX(tl.tanggal_log) AS last_log
        FROM transaksi_log tl
          LEFT JOIN transaksi tId ON tId.id_transaksi = tl.id_grosir
          LEFT JOIN transaksi tKode ON tKode.kode_transaksi = tl.id_grosir
        WHERE tl.jenis_produk='frame'
        GROUP BY tl.id_produk, COALESCE(tId.id_cabang, tKode.id_cabang, tl.id_cabang)
      ) tl ON tl.id_produk=f.id_frame AND tl.id_cabang=fsc.id_cabang
      LEFT JOIN (
        SELECT gl.id_produk,
               gl.id_cabang AS id_cabang,
               MAX(gl.tanggal_log) AS last_log
        FROM grosir_log gl
        WHERE gl.jenis_produk='frame'
        GROUP BY gl.id_produk, gl.id_cabang
      ) gl ON gl.id_produk=f.id_frame AND gl.id_cabang=fsc.id_cabang
      LEFT JOIN (
        SELECT tf.id_frame AS id_produk, t.id_cabang AS id_cabang, MAX(t.tanggal_order) AS last_order
        FROM transaksi_frame tf JOIN transaksi t ON t.kode_transaksi = tf.kode_transaksi
        GROUP BY tf.id_frame, t.id_cabang
      ) ord ON ord.id_produk=f.id_frame AND ord.id_cabang=fsc.id_cabang
      LEFT JOIN (
        SELECT f2.sku_frame AS sku, COALESCE(tId.id_cabang, tKode.id_cabang, tl.id_cabang) AS id_cabang, MAX(tl.tanggal_log) AS last_log
        FROM transaksi_log tl
          LEFT JOIN transaksi tId ON tId.id_transaksi = tl.id_grosir
          LEFT JOIN transaksi tKode ON tKode.kode_transaksi = tl.id_grosir
          LEFT JOIN frame f2 ON f2.id_frame = tl.id_produk
        WHERE tl.jenis_produk='frame'
        GROUP BY sku, COALESCE(tId.id_cabang, tKode.id_cabang, tl.id_cabang)
      ) tls ON tls.sku=f.sku_frame AND tls.id_cabang=fsc.id_cabang
      LEFT JOIN (
        SELECT f2.sku_frame AS sku, gl.id_cabang AS id_cabang, MAX(gl.tanggal_log) AS last_log
        FROM grosir_log gl
          LEFT JOIN frame f2 ON f2.id_frame = gl.id_produk
        WHERE gl.jenis_produk='frame'
        GROUP BY sku, gl.id_cabang
      ) gls ON gls.sku=f.sku_frame AND gls.id_cabang=fsc.id_cabang
    WHERE fsc.stok_cb > 0
    UNION ALL
    SELECT 'lensa' AS jenis, l.id_lensa AS id, CONCAT((SELECT nama_lensa_kat FROM lensa_kat WHERE lensa_kat.id_lensa_kat=l.id_lensa_kat),' ', l.size) AS nama, l.sku_lensa AS sku,
           l.harga_modal, l.harga_jual, lsc.stok_masuk AS stok,
           GREATEST(
             COALESCE(tl.last_log, '1970-01-01'),
             COALESCE(gl.last_log, '1970-01-01'),
             COALESCE(ord.last_order, '1970-01-01')
           ) AS last_log
    FROM lensa l
      JOIN lensa_stok_cabang lsc ON lsc.id_lensa=l.id_lensa AND lsc.id_cabang=?
      LEFT JOIN (
        SELECT tl.id_produk,
               COALESCE(tId.id_cabang, tKode.id_cabang, tl.id_cabang) AS id_cabang,
               MAX(tl.tanggal_log) AS last_log
        FROM transaksi_log tl
          LEFT JOIN transaksi tId ON tId.id_transaksi = tl.id_grosir
          LEFT JOIN transaksi tKode ON tKode.kode_transaksi = tl.id_grosir
        WHERE tl.jenis_produk='lensa'
        GROUP BY tl.id_produk, COALESCE(tId.id_cabang, tKode.id_cabang, tl.id_cabang)
      ) tl ON tl.id_produk=l.id_lensa AND tl.id_cabang=lsc.id_cabang
      LEFT JOIN (
        SELECT gl.id_produk,
               gl.id_cabang AS id_cabang,
               MAX(gl.tanggal_log) AS last_log
        FROM grosir_log gl
        WHERE gl.jenis_produk='lensa'
        GROUP BY gl.id_produk, gl.id_cabang
      ) gl ON gl.id_produk=l.id_lensa AND gl.id_cabang=lsc.id_cabang
      LEFT JOIN (
        SELECT tl2.id_lensa AS id_produk, t.id_cabang AS id_cabang, MAX(t.tanggal_order) AS last_order
        FROM transaksi_lensa tl2 JOIN transaksi t ON t.kode_transaksi = tl2.kode_transaksi
        GROUP BY tl2.id_lensa, t.id_cabang
      ) ord ON ord.id_produk=l.id_lensa AND ord.id_cabang=lsc.id_cabang
    WHERE lsc.stok_masuk > 0
  `
  const sql = `
    SELECT u.*, TIMESTAMPDIFF(MONTH, DATE(u.last_log), CURDATE()) AS months_since_log
    FROM ( ${sqlUnion} ) u
    WHERE TIMESTAMPDIFF(MONTH, DATE(u.last_log), CURDATE()) >= ?
    ORDER BY months_since_log DESC
  `
  const t0 = Date.now()
  const [rows] = await pool.query({ sql, values: params, timeout: 120000 })
  const dur = Date.now() - t0
  const msg = `[AsetIdle] cabang=${cabangId} months=${months} rows=${rows.length} ms=${dur}`
  console.log(msg)
  const summary = rows.reduce((acc, r) => {
    acc.total_aset += Number(r.harga_modal || 0) * Number(r.stok || 0)
    return acc
  }, { total_aset: 0 })
  let result = { data: rows, summary }
  try {
    const jenisList = Array.from(new Set(rows.map(r => r.jenis)))
    const idList = Array.from(new Set(rows.map(r => Number(r.id))))
    if (jenisList.length && idList.length) {
      const jenisPlace = jenisList.map(() => '?').join(',')
      const idPlace = idList.map(() => '?').join(',')
      const [stRows] = await pool.query(`SELECT jenis, product_id, status FROM asset_status WHERE jenis IN (${jenisPlace}) AND product_id IN (${idPlace})`, [...jenisList, ...idList])
      const map = new Map(stRows.map(s => [`${s.jenis}:${s.product_id}`, Number(s.status || 1)]))
      const merged = rows.map(r => ({ ...r, status: map.get(`${r.jenis}:${Number(r.id)}`) ?? 1 }))
      const filtered = merged.filter(r => Number(r.status || 1) === 1)
      const lookback = Math.max(1, Number(months || 3))
      const jenisPlaceHist = jenisList.map(() => '?').join(',')
      const idPlaceHist = idList.map(() => '?').join(',')
      const lookbackHist = Math.max(0, Number(historyMonths ?? months ?? 3))
      const [tlRows] = await pool.query({
        sql: `SELECT tl.jenis_produk AS jenis, tl.id_produk AS id, tl.tanggal_log AS tanggal, tl.jumlah, 
                     (CASE WHEN tl.jumlah_harga = 0 THEN (tl.harga_produk * tl.jumlah) ELSE tl.jumlah_harga END) AS jumlah_uang,
                     tl.harga_produk, t.kode_transaksi, admin.nama_lengkap AS nama_marketing, customer.nama_customer, 'transaksi' AS sumber
              FROM transaksi_log tl
                LEFT JOIN transaksi t ON (t.id_transaksi = tl.id_grosir OR t.kode_transaksi = tl.id_grosir)
                LEFT JOIN customer ON customer.kode_customer = t.kode_customer
                LEFT JOIN admin ON admin.id = t.id_marketing
              WHERE COALESCE(t.id_cabang, tl.id_cabang) = ?
                AND tl.jenis_produk IN (${jenisPlaceHist})
                AND tl.id_produk IN (${idPlaceHist})
                AND (? = 0 OR tl.tanggal_log >= CURDATE() - INTERVAL ? MONTH)
              ORDER BY tl.tanggal_log DESC`,
        values: [cabangId, ...jenisList, ...idList, lookbackHist, lookbackHist], timeout: 60000
      })
      const [glRows] = await pool.query({
        sql: `SELECT gl.jenis_produk AS jenis, gl.id_produk AS id, gl.tanggal_log AS tanggal, gl.jumlah,
                     (CASE WHEN gl.jumlah_harga = 0 THEN (gl.harga_produk * gl.jumlah) ELSE gl.jumlah_harga END) AS jumlah_uang,
                     gl.harga_produk, g.kode_grosir AS kode_transaksi, g.tipe_transaksi, customer.nama_customer, 'grosir' AS sumber
              FROM grosir_log gl
                LEFT JOIN grosir g ON g.kode_grosir = gl.id_grosir
                LEFT JOIN customer ON customer.kode_customer = g.kode_customer
              WHERE gl.id_cabang = ?
                AND gl.jenis_produk IN (${jenisPlaceHist})
                AND gl.id_produk IN (${idPlaceHist})
                AND (? = 0 OR gl.tanggal_log >= CURDATE() - INTERVAL ? MONTH)
              ORDER BY gl.tanggal_log DESC`,
        values: [cabangId, ...jenisList, ...idList, lookbackHist, lookbackHist], timeout: 60000
      })
      const [tbRows] = await pool.query({
        sql: `SELECT 'katalog' AS jenis, tb.id_produk AS id, t.tanggal_order AS tanggal, tb.qty AS jumlah,
                     ((SELECT harga_jual FROM produk WHERE produk.id_produk = tb.id_produk) * tb.qty) AS jumlah_uang,
                     (SELECT harga_jual FROM produk WHERE produk.id_produk = tb.id_produk) AS harga_produk,
                     t.kode_transaksi, admin.nama_lengkap AS nama_marketing, customer.nama_customer, 'transaksi' AS sumber
              FROM transaksi_barang tb
                JOIN transaksi t ON t.kode_transaksi = tb.kode_transaksi
                LEFT JOIN customer ON customer.kode_customer = t.kode_customer
                LEFT JOIN admin ON admin.id = t.id_marketing
              WHERE t.id_cabang = ? AND tb.id_produk IN (${idPlaceHist}) AND (? = 0 OR t.tanggal_order >= CURDATE() - INTERVAL ? MONTH)`,
        values: [cabangId, ...idList, lookbackHist, lookbackHist], timeout: 60000
      })
      const [tfRows] = await pool.query({
        sql: `SELECT 'frame' AS jenis, tf.id_frame AS id, t.tanggal_order AS tanggal, tf.qty AS jumlah,
                     ((SELECT harga_jual FROM frame WHERE frame.id_frame = tf.id_frame) * tf.qty) AS jumlah_uang,
                     (SELECT harga_jual FROM frame WHERE frame.id_frame = tf.id_frame) AS harga_produk,
                     t.kode_transaksi, admin.nama_lengkap AS nama_marketing, customer.nama_customer, 'transaksi' AS sumber
              FROM transaksi_frame tf
                JOIN transaksi t ON t.kode_transaksi = tf.kode_transaksi
                LEFT JOIN customer ON customer.kode_customer = t.kode_customer
                LEFT JOIN admin ON admin.id = t.id_marketing
              WHERE t.id_cabang = ? AND tf.id_frame IN (${idPlaceHist}) AND (? = 0 OR t.tanggal_order >= CURDATE() - INTERVAL ? MONTH)`,
        values: [cabangId, ...idList, lookbackHist, lookbackHist], timeout: 60000
      })
      const [tl2Rows] = await pool.query({
        sql: `SELECT 'lensa' AS jenis, tl2.id_lensa AS id, t.tanggal_order AS tanggal, tl2.qty AS jumlah,
                     ((SELECT harga_jual FROM lensa WHERE lensa.id_lensa = tl2.id_lensa) * tl2.qty) AS jumlah_uang,
                     (SELECT harga_jual FROM lensa WHERE lensa.id_lensa = tl2.id_lensa) AS harga_produk,
                     t.kode_transaksi, admin.nama_lengkap AS nama_marketing, customer.nama_customer, 'transaksi' AS sumber
              FROM transaksi_lensa tl2
                JOIN transaksi t ON t.kode_transaksi = tl2.kode_transaksi
                LEFT JOIN customer ON customer.kode_customer = t.kode_customer
                LEFT JOIN admin ON admin.id = t.id_marketing
              WHERE t.id_cabang = ? AND tl2.id_lensa IN (${idPlaceHist}) AND (? = 0 OR t.tanggal_order >= CURDATE() - INTERVAL ? MONTH)`,
        values: [cabangId, ...idList, lookbackHist, lookbackHist], timeout: 60000
      })
      const allHist = [...tlRows, ...glRows]
      const allOrders = [...tbRows, ...tfRows, ...tl2Rows]
      const histMap = new Map()
      for (const h of allHist) {
        const key = `${String(h.jenis)}:${Number(h.id)}`
        const cur = histMap.get(key) || []
        cur.push(h)
        histMap.set(key, cur)
      }
      const orderMap = new Map()
      for (const h of allOrders) {
        const key = `${String(h.jenis)}:${Number(h.id)}`
        const cur = orderMap.get(key) || []
        cur.push(h)
        orderMap.set(key, cur)
      }
      const enriched = filtered.map(r => {
        const key = `${String(r.jenis)}:${Number(r.id)}`
        const hist = (histMap.get(key) || []).sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal))
        const orders = (orderMap.get(key) || []).sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal))
        const topHist = includeAllHistory ? hist : hist.slice(0, 10)
        const topOrders = includeAllHistory ? orders : orders.slice(0, 10)
        const marketing_transactions = [...topHist.filter(x => x.sumber === 'transaksi'), ...topOrders]
        const toko_transactions = top.filter(x => x.sumber === 'grosir')
        const sum_qty_period = [...hist, ...orders].reduce((acc, x) => acc + Number(x.jumlah || 0), 0)
        const sum_uang_period = [...hist, ...orders].reduce((acc, x) => acc + Number(x.jumlah_uang || 0), 0)
        return {
          ...r,
          total_aset_value: Number(r.harga_modal || 0) * Number(r.stok || 0),
          estimasi_penjualan_value: Number(r.harga_jual || 0) * Number(r.stok || 0),
          history: topHist,
          marketing_transactions,
          toko_transactions,
          metrics: { sum_qty_period, sum_uang_period }
        }
      })
      result = { data: enriched, summary }
    }
  } catch { }
  asetCache.idle.set(key, { ts: Date.now(), data: result })
  return result
}

export async function upsertAssetStatus({ jenis, productId, status }) {
  const st = (Number(status) === 1) ? 1 : 0
  const pid = Number(productId)
  if (!jenis || !pid) throw new Error('jenis and productId are required')
  await pool.query('REPLACE INTO asset_status (jenis, product_id, status, updated_at) VALUES (?,?,?,?)', [String(jenis), pid, st, Date.now()])
  try { asetCache.single.clear(); asetCache.idle.clear(); asetCache.idleAll.clear(); asetCache.all = { ts: 0, includeIdle: false, data: null } } catch { }
  return { jenis, productId: pid, status: st }
}

export async function deleteAssetStatus({ jenis, productId }) {
  const pid = Number(productId)
  if (!jenis || !pid) throw new Error('jenis and productId are required')
  await pool.query('DELETE FROM asset_status WHERE jenis=? AND product_id=?', [String(jenis), pid])
  return { jenis, productId: pid }
}

export async function getAssetStatus({ jenis, productId }) {
  const pid = Number(productId)
  if (!jenis || !pid) throw new Error('jenis and productId are required')
  const [rows] = await pool.query('SELECT jenis, product_id, status, updated_at FROM asset_status WHERE jenis=? AND product_id=?', [String(jenis), pid])
  return rows?.[0] || null
}

export async function fetchMasterItems({ jenis, page = 1, limit = 20, q, status, order, soldOnly, cabangId, ready }) {
  const j = String(jenis || '').toLowerCase()
  const allowed = new Set(['katalog', 'softlens', 'frame', 'lensa'])
  if (!allowed.has(j)) throw new Error('jenis invalid')
  const offset = Math.max(0, (Number(page) - 1) * Number(limit))
  const like = q ? `%${String(q).toLowerCase()}%` : null
  const active = await getActivePembukuan(undefined)
  const periodParams = active ? [active.tanggal_buka_buku, active.tanggal_tutup_buku] : []
  let sql = ''
  let sqlCount = ''
  let params = []
  let countParams = []
  const statusFilter = (status === 0 || status === 1) ? Number(status) : undefined
  const whereParts = []
  const orderKey = (order === 'qty' || order === 'uang') ? order : undefined
  if (j === 'katalog') {
    if (like) whereParts.push('(LOWER(p.nama_produk) LIKE ? OR LOWER(p.sku_katalog) LIKE ?)')
    if (statusFilter !== undefined) whereParts.push('COALESCE(ast.status,1) = ?')
    if (cabangId) whereParts.push('p.id_produk IN (SELECT id_produk FROM produk_stok_cabang WHERE id_cabang=? AND stok > 0)')
    if (ready === '1') whereParts.push('(SELECT SUM(stok) FROM produk_stok_cabang WHERE id_produk=p.id_produk) > 0')
    if (ready === '0') whereParts.push('COALESCE((SELECT SUM(stok) FROM produk_stok_cabang WHERE id_produk=p.id_produk), 0) <= 0')
    const whereSqlBasic = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : ''
    const orderSql = orderKey === 'qty' ? 'ORDER BY COALESCE(agg.sum_qty,0) DESC, p.id_produk DESC' : (orderKey === 'uang' ? 'ORDER BY COALESCE(agg.sum_uang,0) DESC, p.id_produk DESC' : 'ORDER BY p.id_produk DESC')
    sql = `SELECT 'katalog' AS jenis, p.id_produk AS id, p.nama_produk AS nama, p.sku_katalog AS sku, p.harga_modal, p.harga_jual, COALESCE(ast.status,1) AS status, COALESCE(agg.sum_qty,0) AS total_qty, COALESCE(agg.sum_uang,0) AS total_uang,
            st.total_stok, st.branch_stocks
          FROM produk p 
          LEFT JOIN asset_status ast ON ast.jenis='katalog' AND ast.product_id=p.id_produk 
          LEFT JOIN (
            SELECT id_produk, SUM(branch_sum) AS total_stok, GROUP_CONCAT(CONCAT(id_cabang, ':', branch_sum)) AS branch_stocks 
            FROM (
              SELECT id_produk, id_cabang, SUM(stok) AS branch_sum 
              FROM produk_stok_cabang GROUP BY id_produk, id_cabang
            ) _st GROUP BY id_produk
          ) st ON st.id_produk = p.id_produk
          LEFT JOIN (
            SELECT id_produk, SUM(sum_qty) AS sum_qty, SUM(sum_uang) AS sum_uang 
            FROM (
              SELECT tb.id_produk, tb.qty AS sum_qty, ((SELECT harga_jual FROM produk WHERE produk.id_produk=tb.id_produk) * tb.qty) AS sum_uang 
              FROM transaksi_barang tb 
              INNER JOIN transaksi t ON t.kode_transaksi=tb.kode_transaksi
              ${cabangId ? 'WHERE t.id_cabang=?' : ''}
              UNION ALL 
              SELECT id_produk, jumlah AS sum_qty, jumlah_harga AS sum_uang 
              FROM grosir_log 
              WHERE jenis_produk='katalog' ${cabangId ? 'AND id_cabang=?' : ''}
            ) u GROUP BY id_produk
          ) agg ON agg.id_produk=p.id_produk 
          ${whereSqlBasic}${soldOnly ? (whereSqlBasic ? ' AND ' : ' WHERE ') + 'COALESCE(agg.sum_qty,0) > 0' : ''} 
          ${orderSql} ${limit > 0 ? 'LIMIT ? OFFSET ?' : ''}`
    if (soldOnly) {
      sqlCount = `SELECT COUNT(*) AS cnt FROM produk p LEFT JOIN asset_status ast ON ast.jenis='katalog' AND ast.product_id=p.id_produk LEFT JOIN (SELECT id_produk, SUM(sum_qty) AS sum_qty FROM (SELECT tb.id_produk, tb.qty AS sum_qty FROM transaksi_barang tb INNER JOIN transaksi t ON t.kode_transaksi=tb.kode_transaksi ${cabangId ? 'WHERE t.id_cabang=?' : ''} UNION ALL SELECT id_produk, jumlah AS sum_qty FROM grosir_log WHERE jenis_produk='katalog' ${cabangId ? 'AND id_cabang=?' : ''}) u GROUP BY id_produk) agg ON agg.id_produk=p.id_produk ${whereSqlBasic}${soldOnly ? (whereSqlBasic ? ' AND ' : ' WHERE ') + 'COALESCE(agg.sum_qty,0) > 0' : ''}`
    } else {
      sqlCount = `SELECT COUNT(*) AS cnt FROM produk p LEFT JOIN asset_status ast ON ast.jenis='katalog' AND ast.product_id=p.id_produk ${whereSqlBasic}`
    }
    // params construction
    params = []
    if (cabangId) params.push(cabangId, cabangId) // for agg join subqueries
    if (like) params.push(like, like)
    if (statusFilter !== undefined) params.push(statusFilter)
    if (cabangId) params.push(cabangId) // for whereParts subquery

    countParams = []
    if (cabangId) countParams.push(cabangId, cabangId) // for agg join subqueries in sqlCount
    if (like) countParams.push(like, like)
    if (statusFilter !== undefined) countParams.push(statusFilter)
    if (cabangId) countParams.push(cabangId) // for whereParts subquery in sqlCount
  } else if (j === 'softlens') {
    if (like) whereParts.push('(LOWER(s.nama_softlens) LIKE ? OR LOWER(s.sku_softlens) LIKE ?)')
    if (statusFilter !== undefined) whereParts.push('COALESCE(ast.status,1) = ?')
    if (cabangId) whereParts.push('s.id_softlens IN (SELECT id_softlens FROM softlens_stok_cabang WHERE id_cabang=? AND stok > 0)')
    if (ready === '1') whereParts.push('(SELECT SUM(stok) FROM softlens_stok_cabang WHERE id_softlens=s.id_softlens) > 0')
    if (ready === '0') whereParts.push('COALESCE((SELECT SUM(stok) FROM softlens_stok_cabang WHERE id_softlens=s.id_softlens), 0) <= 0')
    const whereSqlBasic = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : ''
    const orderSql = orderKey === 'qty' ? 'ORDER BY COALESCE(agg.sum_qty,0) DESC, s.id_softlens DESC' : (orderKey === 'uang' ? 'ORDER BY COALESCE(agg.sum_uang,0) DESC, s.id_softlens DESC' : 'ORDER BY s.id_softlens DESC')
    sql = `SELECT 'softlens' AS jenis, s.id_softlens AS id, s.nama_softlens AS nama, s.sku_softlens AS sku, s.harga_modal, s.harga_jual, COALESCE(ast.status,1) AS status, COALESCE(agg.sum_qty,0) AS total_qty, COALESCE(agg.sum_uang,0) AS total_uang,
            st.total_stok, st.branch_stocks
          FROM softlens s 
          LEFT JOIN asset_status ast ON ast.jenis='softlens' AND ast.product_id=s.id_softlens 
          LEFT JOIN (
            SELECT id_softlens, SUM(branch_sum) AS total_stok, GROUP_CONCAT(CONCAT(id_cabang, ':', branch_sum)) AS branch_stocks 
            FROM (
              SELECT id_softlens, id_cabang, SUM(stok) AS branch_sum 
              FROM softlens_stok_cabang GROUP BY id_softlens, id_cabang
            ) _st GROUP BY id_softlens
          ) st ON st.id_softlens = s.id_softlens
          LEFT JOIN (
            SELECT id_produk, SUM(sum_qty) AS sum_qty, SUM(sum_uang) AS sum_uang 
            FROM (
              SELECT ts.id_produk, ts.qty AS sum_qty, ((SELECT harga_jual FROM softlens WHERE softlens.id_softlens=ts.id_produk) * ts.qty) AS sum_uang 
              FROM transaksi_barang ts INNER JOIN transaksi t ON t.kode_transaksi=ts.kode_transaksi 
              ${cabangId ? 'WHERE t.id_cabang=?' : ''}
              UNION ALL 
              SELECT id_produk, jumlah AS sum_qty, jumlah_harga AS sum_uang 
              FROM grosir_log 
              WHERE jenis_produk='softlens' ${cabangId ? 'AND id_cabang=?' : ''}
            ) u GROUP BY id_produk
          ) agg ON agg.id_produk=s.id_softlens 
          ${whereSqlBasic}${soldOnly ? (whereSqlBasic ? ' AND ' : ' WHERE ') + 'COALESCE(agg.sum_qty,0) > 0' : ''} 
          ${orderSql} ${limit > 0 ? 'LIMIT ? OFFSET ?' : ''}`
    if (soldOnly) {
      sqlCount = `SELECT COUNT(*) AS cnt FROM softlens s LEFT JOIN asset_status ast ON ast.jenis='softlens' AND ast.product_id=s.id_softlens LEFT JOIN (SELECT id_produk, SUM(sum_qty) AS sum_qty FROM (SELECT ts.id_produk, ts.qty AS sum_qty FROM transaksi_barang ts INNER JOIN transaksi t ON t.kode_transaksi=ts.kode_transaksi ${cabangId ? 'WHERE t.id_cabang=?' : ''} UNION ALL SELECT id_produk, jumlah AS sum_qty FROM grosir_log WHERE jenis_produk='softlens' ${cabangId ? 'AND id_cabang=?' : ''}) u GROUP BY id_produk) agg ON agg.id_produk=s.id_softlens ${whereSqlBasic}${soldOnly ? (whereSqlBasic ? ' AND ' : ' WHERE ') + 'COALESCE(agg.sum_qty,0) > 0' : ''}`
    } else {
      sqlCount = `SELECT COUNT(*) AS cnt FROM softlens s LEFT JOIN asset_status ast ON ast.jenis='softlens' AND ast.product_id=s.id_softlens ${whereSqlBasic}`
    }
    // params construction
    params = []
    if (cabangId) params.push(cabangId, cabangId) // for agg join subqueries
    if (like) params.push(like, like)
    if (statusFilter !== undefined) params.push(statusFilter)
    if (cabangId) params.push(cabangId) // for whereParts subquery

    countParams = []
    if (cabangId) countParams.push(cabangId, cabangId) // for agg join subqueries in sqlCount
    if (like) countParams.push(like, like)
    if (statusFilter !== undefined) countParams.push(statusFilter)
    if (cabangId) countParams.push(cabangId) // for whereParts subquery in sqlCount
  } else if (j === 'frame') {
    if (like) whereParts.push('(LOWER((SELECT nama_frame FROM frame_kat WHERE frame_kat.id_kat_frame=f.id_kat_frame)) LIKE ? OR LOWER(f.sku_frame) LIKE ?)')
    if (statusFilter !== undefined) whereParts.push('COALESCE(ast.status,1) = ?')
    if (cabangId) whereParts.push('f.id_frame IN (SELECT id_frame FROM frame_stok_cabang WHERE id_cabang=? AND stok_cb > 0)')
    if (ready === '1') whereParts.push('(SELECT SUM(stok_cb) FROM frame_stok_cabang WHERE id_frame=f.id_frame) > 0')
    if (ready === '0') whereParts.push('COALESCE((SELECT SUM(stok_cb) FROM frame_stok_cabang WHERE id_frame=f.id_frame), 0) <= 0')
    const whereSqlBasic = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : ''
    const orderSql = orderKey === 'qty' ? 'ORDER BY COALESCE(agg.sum_qty,0) DESC, f.id_frame DESC' : (orderKey === 'uang' ? 'ORDER BY COALESCE(agg.sum_uang,0) DESC, f.id_frame DESC' : 'ORDER BY f.id_frame DESC')
    sql = `SELECT 'frame' AS jenis, f.id_frame AS id, (SELECT nama_frame FROM frame_kat WHERE frame_kat.id_kat_frame=f.id_kat_frame) AS nama, f.sku_frame AS sku, f.harga_modal, f.harga_jual, COALESCE(ast.status,1) AS status, COALESCE(agg.sum_qty,0) AS total_qty, COALESCE(agg.sum_uang,0) AS total_uang,
            st.total_stok, st.branch_stocks
          FROM frame f 
          LEFT JOIN asset_status ast ON ast.jenis='frame' AND ast.product_id=f.id_frame 
          LEFT JOIN (
            SELECT id_frame, SUM(branch_sum) AS total_stok, GROUP_CONCAT(CONCAT(id_cabang, ':', branch_sum)) AS branch_stocks 
            FROM (
              SELECT id_frame, id_cabang, SUM(stok_cb) AS branch_sum 
              FROM frame_stok_cabang GROUP BY id_frame, id_cabang
            ) _st GROUP BY id_frame
          ) st ON st.id_frame = f.id_frame
          LEFT JOIN (
            SELECT id_produk, SUM(sum_qty) AS sum_qty, SUM(sum_uang) AS sum_uang 
            FROM (
              SELECT tf.id_frame AS id_produk, tf.qty AS sum_qty, ((SELECT harga_jual FROM frame WHERE frame.id_frame=tf.id_frame) * tf.qty) AS sum_uang 
              FROM transaksi_frame tf INNER JOIN transaksi t ON t.kode_transaksi=tf.kode_transaksi 
              ${cabangId ? 'WHERE t.id_cabang=?' : ''}
              UNION ALL 
              SELECT id_produk, jumlah AS sum_qty, jumlah_harga AS sum_uang 
              FROM grosir_log 
              WHERE jenis_produk='frame' ${cabangId ? 'AND id_cabang=?' : ''}
            ) u GROUP BY id_produk
          ) agg ON agg.id_produk=f.id_frame 
          ${whereSqlBasic}${soldOnly ? (whereSqlBasic ? ' AND ' : ' WHERE ') + 'COALESCE(agg.sum_qty,0) > 0' : ''} 
          ${orderSql} ${limit > 0 ? 'LIMIT ? OFFSET ?' : ''}`
    if (soldOnly) {
      sqlCount = `SELECT COUNT(*) AS cnt FROM frame f LEFT JOIN asset_status ast ON ast.jenis='frame' AND ast.product_id=f.id_frame LEFT JOIN (SELECT id_produk, SUM(sum_qty) AS sum_qty FROM (SELECT tf.id_frame AS id_produk, tf.qty AS sum_qty FROM transaksi_frame tf INNER JOIN transaksi t ON t.kode_transaksi=tf.kode_transaksi ${cabangId ? 'WHERE t.id_cabang=?' : ''} UNION ALL SELECT id_produk, jumlah AS sum_qty FROM grosir_log WHERE jenis_produk='frame' ${cabangId ? 'AND id_cabang=?' : ''}) u GROUP BY id_produk) agg ON agg.id_produk=f.id_frame ${whereSqlBasic}${soldOnly ? (whereSqlBasic ? ' AND ' : ' WHERE ') + 'COALESCE(agg.sum_qty,0) > 0' : ''}`
    } else {
      sqlCount = `SELECT COUNT(*) AS cnt FROM frame f LEFT JOIN asset_status ast ON ast.jenis='frame' AND ast.product_id=f.id_frame ${whereSqlBasic}`
    }
    // params construction
    params = []
    if (cabangId) params.push(cabangId, cabangId) // for agg join subqueries
    if (like) params.push(like, like)
    if (statusFilter !== undefined) params.push(statusFilter)
    if (cabangId) params.push(cabangId) // for whereParts subquery

    countParams = []
    if (cabangId) countParams.push(cabangId, cabangId) // for agg join subqueries in sqlCount
    if (like) countParams.push(like, like)
    if (statusFilter !== undefined) countParams.push(statusFilter)
    if (cabangId) countParams.push(cabangId) // for whereParts subquery in sqlCount
  } else if (j === 'lensa') {
    if (like) whereParts.push("(LOWER(CONCAT((SELECT nama_lensa_kat FROM lensa_kat WHERE lensa_kat.id_lensa_kat=l.id_lensa_kat), ' ', l.size)) LIKE ? OR LOWER(l.sku_lensa) LIKE ?)")
    if (statusFilter !== undefined) whereParts.push('COALESCE(ast.status,1) = ?')
    if (cabangId) whereParts.push('l.id_lensa IN (SELECT id_lensa FROM lensa_stok_cabang WHERE id_cabang=? AND stok_masuk > 0)')
    if (ready === '1') whereParts.push('(SELECT SUM(stok_masuk) FROM lensa_stok_cabang WHERE id_lensa=l.id_lensa) > 0')
    if (ready === '0') whereParts.push('COALESCE((SELECT SUM(stok_masuk) FROM lensa_stok_cabang WHERE id_lensa=l.id_lensa), 0) <= 0')
    const whereSqlBasic = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : ''
    const orderSql = orderKey === 'qty' ? 'ORDER BY COALESCE(agg.sum_qty,0) DESC, l.id_lensa DESC' : (orderKey === 'uang' ? 'ORDER BY COALESCE(agg.sum_uang,0) DESC, l.id_lensa DESC' : 'ORDER BY l.id_lensa DESC')
    sql = `SELECT 'lensa' AS jenis, l.id_lensa AS id, CONCAT((SELECT nama_lensa_kat FROM lensa_kat WHERE lensa_kat.id_lensa_kat=l.id_lensa_kat), ' ', l.size) AS nama, l.sku_lensa AS sku, l.harga_modal, l.harga_jual, COALESCE(ast.status,1) AS status, COALESCE(agg.sum_qty,0) AS total_qty, COALESCE(agg.sum_uang,0) AS total_uang,
            st.total_stok, st.branch_stocks
          FROM lensa l 
          LEFT JOIN asset_status ast ON ast.jenis='lensa' AND ast.product_id=l.id_lensa 
          LEFT JOIN (
            SELECT id_lensa, SUM(branch_sum) AS total_stok, GROUP_CONCAT(CONCAT(id_cabang, ':', branch_sum)) AS branch_stocks 
            FROM (
              SELECT id_lensa, id_cabang, SUM(stok_masuk) AS branch_sum 
              FROM lensa_stok_cabang GROUP BY id_lensa, id_cabang
            ) _st GROUP BY id_lensa
          ) st ON st.id_lensa = l.id_lensa
          LEFT JOIN (
            SELECT id_produk, SUM(sum_qty) AS sum_qty, SUM(sum_uang) AS sum_uang 
            FROM (
              SELECT tl.id_lensa AS id_produk, tl.qty AS sum_qty, ((SELECT harga_jual FROM lensa WHERE lensa.id_lensa=tl.id_lensa) * tl.qty) AS sum_uang 
              FROM transaksi_lensa tl INNER JOIN transaksi t ON t.kode_transaksi=tl.kode_transaksi 
              ${cabangId ? 'WHERE t.id_cabang=?' : ''}
              UNION ALL 
              SELECT id_produk, jumlah AS sum_qty, jumlah_harga AS sum_uang 
              FROM grosir_log 
              WHERE jenis_produk='lensa' ${cabangId ? 'AND id_cabang=?' : ''}
            ) u GROUP BY id_produk
          ) agg ON agg.id_produk=l.id_lensa 
          ${whereSqlBasic}${soldOnly ? (whereSqlBasic ? ' AND ' : ' WHERE ') + 'COALESCE(agg.sum_qty,0) > 0' : ''} 
          ${orderSql} ${limit > 0 ? 'LIMIT ? OFFSET ?' : ''}`
    if (soldOnly) {
      sqlCount = `SELECT COUNT(*) AS cnt FROM lensa l LEFT JOIN asset_status ast ON ast.jenis='lensa' AND ast.product_id=l.id_lensa LEFT JOIN (SELECT id_produk, SUM(sum_qty) AS sum_qty FROM (SELECT tl.id_lensa AS id_produk, tl.qty AS sum_qty FROM transaksi_lensa tl INNER JOIN transaksi t ON t.kode_transaksi=tl.kode_transaksi ${cabangId ? 'WHERE t.id_cabang=?' : ''} UNION ALL SELECT id_produk, jumlah AS sum_qty FROM grosir_log WHERE jenis_produk='lensa' ${cabangId ? 'AND id_cabang=?' : ''}) u GROUP BY id_produk) agg ON agg.id_produk=l.id_lensa ${whereSqlBasic}${soldOnly ? (whereSqlBasic ? ' AND ' : ' WHERE ') + 'COALESCE(agg.sum_qty,0) > 0' : ''}`
    } else {
      sqlCount = `SELECT COUNT(*) AS cnt FROM lensa l LEFT JOIN asset_status ast ON ast.jenis='lensa' AND ast.product_id=l.id_lensa ${whereSqlBasic}`
    }
    // params construction
    params = []
    if (cabangId) params.push(cabangId, cabangId) // for agg join subqueries
    if (like) params.push(like, like)
    if (statusFilter !== undefined) params.push(statusFilter)
    if (cabangId) params.push(cabangId) // for whereParts subquery

    countParams = []
    if (cabangId) countParams.push(cabangId, cabangId) // for agg join subqueries in sqlCount
    if (like) countParams.push(like, like)
    if (statusFilter !== undefined) countParams.push(statusFilter)
    if (cabangId) countParams.push(cabangId) // for whereParts subquery in sqlCount
  }
  if (limit > 0) { params.push(Number(limit), Number(offset)) }
  const [rows] = await pool.query({ sql, values: params, timeout: 15000 })
  const [cntRows] = await pool.query({ sql: sqlCount, values: countParams, timeout: 15000 })
  const total = Number(cntRows?.[0]?.cnt || 0)
  return { data: rows, meta: { page, limit, total, totalPages: limit > 0 ? Math.ceil(total / limit) : 1 } }
}

export async function fetchAsetIdleSummaryAll({ months = 3 }) {
  const key = `all:${months}`
  const now = Date.now()
  const cached = asetCache.idleAll.get(key)
  if (cached && (now - cached.ts) < ASET_CACHE_TTL_MS) {
    console.log(`[AsetIdleAllCache] months=${months} hit age=${now - cached.ts}ms`)
    return cached.data
  }
  const lookback = Math.max(1, Number(months || 3))
  const sqlUnion = `
    SELECT p.harga_modal, p.harga_jual, sc.stok AS stok,
           GREATEST(COALESCE(tl.last_log, '1970-01-01'), COALESCE(gl.last_log, '1970-01-01')) AS last_log
    FROM produk p
      JOIN produk_stok_cabang sc ON sc.id_produk=p.id_produk
      LEFT JOIN asset_status ast ON ast.jenis='katalog' AND ast.product_id=p.id_produk
      LEFT JOIN (
        SELECT id_produk, id_cabang, MAX(tanggal_log) AS last_log
        FROM transaksi_log WHERE jenis_produk='katalog' AND tanggal_log >= CURDATE() - INTERVAL ${lookback} MONTH
        GROUP BY id_produk, id_cabang
      ) tl ON tl.id_produk=p.id_produk AND tl.id_cabang=sc.id_cabang
      LEFT JOIN (
        SELECT id_produk, id_cabang, MAX(tanggal_log) AS last_log
        FROM grosir_log WHERE jenis_produk='katalog' AND tanggal_log >= CURDATE() - INTERVAL ${lookback} MONTH
        GROUP BY id_produk, id_cabang
      ) gl ON gl.id_produk=p.id_produk AND gl.id_cabang=sc.id_cabang
    WHERE sc.stok > 0 AND COALESCE(ast.status,1) = 1
    UNION ALL
    SELECT s.harga_modal, s.harga_jual, ssc.stok AS stok,
           GREATEST(COALESCE(tl.last_log, '1970-01-01'), COALESCE(gl.last_log, '1970-01-01')) AS last_log
    FROM softlens s
      JOIN softlens_stok_cabang ssc ON ssc.id_softlens=s.id_softlens
      LEFT JOIN asset_status ast ON ast.jenis='softlens' AND ast.product_id=s.id_softlens
      LEFT JOIN (
        SELECT id_produk, id_cabang, MAX(tanggal_log) AS last_log
        FROM transaksi_log WHERE jenis_produk='softlens' AND tanggal_log >= CURDATE() - INTERVAL ${lookback} MONTH
        GROUP BY id_produk, id_cabang
      ) tl ON tl.id_produk=s.id_softlens AND tl.id_cabang=ssc.id_cabang
      LEFT JOIN (
        SELECT id_produk, id_cabang, MAX(tanggal_log) AS last_log
        FROM grosir_log WHERE jenis_produk='softlens' AND tanggal_log >= CURDATE() - INTERVAL ${lookback} MONTH
        GROUP BY id_produk, id_cabang
      ) gl ON gl.id_produk=s.id_softlens AND gl.id_cabang=ssc.id_cabang
    WHERE ssc.stok > 0 AND COALESCE(ast.status,1) = 1
    UNION ALL
    SELECT f.harga_modal, f.harga_jual, fsc.stok_cb AS stok,
           GREATEST(COALESCE(tl.last_log, '1970-01-01'), COALESCE(gl.last_log, '1970-01-01')) AS last_log
    FROM frame f
      JOIN frame_stok_cabang fsc ON fsc.id_frame=f.id_frame
      LEFT JOIN asset_status ast ON ast.jenis='frame' AND ast.product_id=f.id_frame
      LEFT JOIN (
        SELECT id_produk, id_cabang, MAX(tanggal_log) AS last_log
        FROM transaksi_log WHERE jenis_produk='frame' AND tanggal_log >= CURDATE() - INTERVAL ${lookback} MONTH
        GROUP BY id_produk, id_cabang
      ) tl ON tl.id_produk=f.id_frame AND tl.id_cabang=fsc.id_cabang
      LEFT JOIN (
        SELECT id_produk, id_cabang, MAX(tanggal_log) AS last_log
        FROM grosir_log WHERE jenis_produk='frame' AND tanggal_log >= CURDATE() - INTERVAL ${lookback} MONTH
        GROUP BY id_produk, id_cabang
      ) gl ON gl.id_produk=f.id_frame AND gl.id_cabang=fsc.id_cabang
    WHERE fsc.stok_cb > 0 AND COALESCE(ast.status,1) = 1
    UNION ALL
    SELECT l.harga_modal, l.harga_jual, lsc.stok_masuk AS stok,
           GREATEST(COALESCE(tl.last_log, '1970-01-01'), COALESCE(gl.last_log, '1970-01-01')) AS last_log
    FROM lensa l
      JOIN lensa_stok_cabang lsc ON lsc.id_lensa=l.id_lensa
      LEFT JOIN asset_status ast ON ast.jenis='lensa' AND ast.product_id=l.id_lensa
      LEFT JOIN (
        SELECT id_produk, id_cabang, MAX(tanggal_log) AS last_log
        FROM transaksi_log WHERE jenis_produk='lensa' AND tanggal_log >= CURDATE() - INTERVAL ${lookback} MONTH
        GROUP BY id_produk, id_cabang
      ) tl ON tl.id_produk=l.id_lensa AND tl.id_cabang=lsc.id_cabang
      LEFT JOIN (
        SELECT id_produk, id_cabang, MAX(tanggal_log) AS last_log
        FROM grosir_log WHERE jenis_produk='lensa' AND tanggal_log >= CURDATE() - INTERVAL ${lookback} MONTH
        GROUP BY id_produk, id_cabang
      ) gl ON gl.id_produk=l.id_lensa AND gl.id_cabang=lsc.id_cabang
    WHERE lsc.stok_masuk > 0 AND COALESCE(ast.status,1) = 1
  `
  const sql = `
    SELECT SUM(u.harga_modal * u.stok) AS total_aset, SUM(u.harga_jual * u.stok) AS estimasi_penjualan
    FROM ( ${sqlUnion} ) u
    WHERE TIMESTAMPDIFF(MONTH, DATE(u.last_log), CURDATE()) >= ?
  `
  const t0 = Date.now()
  const [rows] = await pool.query({ sql, values: [months], timeout: 120000 })
  const dur = Date.now() - t0
  console.log(`[AsetIdleAll] months=${months} ms=${dur}`)
  const result = { summary: { total_aset: Number(rows?.[0]?.total_aset || 0), estimasi_penjualan: Number(rows?.[0]?.estimasi_penjualan || 0) } }
  asetCache.idleAll.set(key, { ts: Date.now(), data: result })
  return result
}
// moved to top
const s3 = (() => {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'id-jkt-1-default'
  const endpoint = process.env.AWS_S3_ENDPOINT || 'https://is3.cloudhost.id'
  if (!accessKeyId || !secretAccessKey) return null
  return new S3Client({ region, endpoint, forcePathStyle: true, credentials: { accessKeyId, secretAccessKey } })
})()

async function buildS3Url({ bucket, key }) {
  const base = process.env.AWS_S3_BASE_URL || process.env.AWS_S3_ENDPOINT || 'is3.cloudhost.id'
  if (s3) {
    try {
      const cmd = new GetObjectCommand({ Bucket: bucket, Key: key })
      const url = await getSignedUrl(s3, cmd, { expiresIn: 3600 })
      return url
    } catch (e) {
    }
  }
  return `https://${base}/${bucket}/${key}`
}

/**
 * Fetch transactions with DP (Down Payment) below 20%
 * Transaksi dengan DP dibawah 20% dari total harga yang masih belum lunas
 */
export async function fetchLowDPTransactions({ pembukuanId, marketingId, cabangId, page = 1, limit = 20, q }) {
  const active = await getActivePembukuan(pembukuanId)
  if (!active) return { data: [], total: 0, summary: {} }
  const offset = Math.max(0, (Number(page) - 1) * Number(limit))
  const paramsBase = [active.tanggal_buka_buku, active.tanggal_tutup_buku]
  const paramsWhere = [active.tanggal_buka_buku, active.tanggal_tutup_buku]

  let whereTransaksi = 'WHERE 1=1'
  whereTransaksi += ' AND transaksi.tanggal_order BETWEEN ? AND ?'
  if (marketingId) { whereTransaksi += ' AND transaksi.id_marketing = ?'; paramsWhere.push(marketingId) }
  if (cabangId) { whereTransaksi += ' AND transaksi.id_cabang = ?'; paramsWhere.push(cabangId) }
  if (q) { whereTransaksi += ' AND (transaksi.kode_transaksi LIKE ? OR customer.nama_customer LIKE ? OR admin.nama_lengkap LIKE ?)'; const like = `%${q}%`; paramsWhere.push(like, like, like) }

  const baseJoin = `
    FROM transaksi
    LEFT JOIN (
      SELECT kode_transaksi, SUM(jumlah_bayar + IFNULL(bayar_lain, 0) + IFNULL(potong_marketing, 0)) AS jml_bayar,
             MAX(jenis_transaksi) AS jenis_transaksi,
             MAX(tanggal_bayar) AS tanggal_bayar
      FROM transaksi_pembayaran
      WHERE tanggal_bayar BETWEEN ? AND ?
        AND jenis_transaksi NOT IN ('piutang','kolektor')
        AND (tipe_bayar = '1' OR tipe_bayar = 1)
      GROUP BY kode_transaksi
    ) tp ON tp.kode_transaksi = transaksi.kode_transaksi
    LEFT JOIN (
      SELECT kode_transaksi, SUM(voucher_use) AS total_voucher
      FROM sponsor_voucher_use
      GROUP BY kode_transaksi
    ) svu ON svu.kode_transaksi = transaksi.kode_transaksi
    LEFT JOIN (
      SELECT id_grosir,
             SUM(jumlah_harga) AS sum_jumlah_harga,
             SUM(
               CASE jenis_produk
                 WHEN 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = transaksi_log.id_produk) * jumlah
                 WHEN 'lensa'    THEN (SELECT harga_modal FROM lensa    WHERE lensa.id_lensa = transaksi_log.id_produk) * jumlah
                 WHEN 'frame'    THEN (SELECT harga_modal FROM frame    WHERE frame.id_frame = transaksi_log.id_produk) * jumlah
                 WHEN 'katalog'  THEN (SELECT harga_modal FROM produk   WHERE produk.id_produk = transaksi_log.id_produk) * jumlah
                 ELSE 0
               END
              ) AS sum_modal,
              SUM(
                CASE jenis_produk
                  WHEN 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = transaksi_log.id_produk) * jumlah
                  WHEN 'lensa'    THEN (SELECT harga_ongkir FROM lensa    WHERE lensa.id_lensa = transaksi_log.id_produk) * jumlah
                  WHEN 'frame'    THEN (SELECT harga_ongkir FROM frame    WHERE frame.id_frame = transaksi_log.id_produk) * jumlah
                  WHEN 'katalog'  THEN (SELECT harga_ongkir FROM produk   WHERE produk.id_produk = transaksi_log.id_produk) * jumlah
                  ELSE 0
                END
              ) AS sum_ongkir
      FROM transaksi_log
      WHERE transaksi_log.tanggal_log BETWEEN ? AND ?
      GROUP BY id_grosir
    ) it ON it.id_grosir = transaksi.kode_transaksi OR it.id_grosir = transaksi.id_transaksi
    LEFT JOIN customer ON customer.kode_customer = transaksi.kode_customer
    LEFT JOIN cabang_toko ON cabang_toko.id_cabang = transaksi.id_cabang
    LEFT JOIN admin ON admin.id = transaksi.id_marketing
    ${whereTransaksi}
    AND ((CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) - IFNULL(tp.jml_bayar,0) - IFNULL(svu.total_voucher,0)) > 0
    AND (CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) > 0
    AND ((IFNULL(tp.jml_bayar,0) + IFNULL(svu.total_voucher,0)) / (CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END)) < 0.2
  `

  const sqlData = `
    SELECT transaksi.id_transaksi, transaksi.kode_transaksi, transaksi.tanggal_order,
           customer.nama_customer, customer.kode_customer, customer.status_user AS status_user,
           cabang_toko.nama_cabang, admin.nama_lengkap,
           tp.jml_bayar, UPPER(tp.jenis_transaksi) AS jenis_transaksi_bayar,
           IFNULL(svu.total_voucher, 0) AS total_voucher,
           (CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) AS fix_harga,
           ((CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) - IFNULL(tp.jml_bayar,0) - IFNULL(svu.total_voucher,0)) AS sisa_bayar,
           IFNULL(it.sum_ongkir,0) AS ongkir_items,
           COALESCE((CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) - (IFNULL(it.sum_modal,0) + IFNULL(it.sum_ongkir,0)), 0) AS laba_items,
           ROUND(((IFNULL(tp.jml_bayar,0) + IFNULL(svu.total_voucher,0)) / (CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END)) * 100, 2) AS dp_percent,
           TIMESTAMPDIFF(DAY, transaksi.tanggal_order, CURDATE()) AS days_since_order
    ${baseJoin}
    ORDER BY dp_percent ASC, transaksi.tanggal_order ASC
    ${Number(limit) > 0 ? 'LIMIT ? OFFSET ?' : ''}
  `

  const sqlCount = `
    SELECT COUNT(transaksi.id_transaksi) AS total
    ${baseJoin}
  `

  const sqlSummary = `
    SELECT 
      COUNT(transaksi.id_transaksi) AS total_transaksi,
      SUM((CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END)) AS total_fix_harga,
      SUM(IFNULL(tp.jml_bayar,0)) AS total_dp,
      SUM((CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) - IFNULL(tp.jml_bayar,0) - IFNULL(svu.total_voucher,0)) AS total_sisa_bayar,
      AVG(ROUND((IFNULL(tp.jml_bayar,0) / (CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END)) * 100, 2)) AS avg_dp_percent
    ${baseJoin}
  `

  const paramsItems = [active.tanggal_buka_buku, active.tanggal_tutup_buku]
  const dataParams = Number(limit) > 0 ? [...paramsBase, ...paramsItems, ...paramsWhere, Number(limit), Number(offset)] : [...paramsBase, ...paramsItems, ...paramsWhere]
  const [rows] = await pool.query(sqlData, dataParams)
  const [countRows] = await pool.query(sqlCount, [...paramsBase, ...paramsItems, ...paramsWhere])
  const [summaryRows] = await pool.query(sqlSummary, [...paramsBase, ...paramsItems, ...paramsWhere])

  const total = Number(countRows?.[0]?.total || 0)
  const summary = {
    total_transaksi: Number(summaryRows?.[0]?.total_transaksi || 0),
    total_fix_harga: Number(summaryRows?.[0]?.total_fix_harga || 0),
    total_dp: Number(summaryRows?.[0]?.total_dp || 0),
    total_sisa_bayar: Number(summaryRows?.[0]?.total_sisa_bayar || 0),
    avg_dp_percent: Number(summaryRows?.[0]?.avg_dp_percent || 0)
  }

  return { data: rows, total, summary }
}

export async function fetchBestCustomers({ limit = 50, page = 1, q = '' }) {
  const offset = Math.max(0, (Number(page) - 1) * Number(limit))
  let where = 'WHERE 1=1'
  const params = []

  if (q) {
    where += ' AND (t.kode_customer LIKE ? OR c.nama_customer LIKE ? OR c.no_hp LIKE ?)'
    const like = `%${q}%`
    params.push(like, like, like)
  }

  // Calculate points: 1 point = 1 unit of currency spent
  // Using fix_harga (negotiated price OR total_harga) as the basis
  const sql = `
    SELECT c.kode_customer, c.nama_customer, c.no_hp,
           COUNT(t.id_transaksi) AS total_trx,
           SUM(CASE WHEN (t.harga_nego > 0) THEN t.harga_nego ELSE t.total_harga END) AS total_spent
    FROM transaksi t
    JOIN customer c ON c.kode_customer = t.kode_customer
    ${where}
    GROUP BY c.kode_customer, c.nama_customer, c.no_hp
    ORDER BY total_spent DESC
    LIMIT ? OFFSET ?
  `

  const sqlCount = `
    SELECT COUNT(DISTINCT t.kode_customer) AS total
    FROM transaksi t
    JOIN customer c ON c.kode_customer = t.kode_customer
    ${where}
  `

  const [rows] = await pool.query(sql, [...params, Number(limit), Number(offset)])
  const [countRows] = await pool.query(sqlCount, params)
  const total = Number(countRows?.[0]?.total || 0)

  return { data: rows, total }
}

export async function fetchBestCustomersV2({ limit = 50, page = 1, q = '' }) {
  console.log('[fetchBestCustomersV2] params:', { limit, page, q })
  const offset = Math.max(0, (Number(page) - 1) * Number(limit))
  let where = 'WHERE 1=1'
  const params = []

  if (q) {
    where += ' AND (t.kode_customer LIKE ? OR c.kode_qr LIKE ? OR c.nama_customer LIKE ? OR c.no_hp LIKE ?)'
    const like = `%${q}%`
    params.push(like, like, like, like)
  }
  console.log('[fetchBestCustomersV2] where:', where, 'params:', params)

  /*
    Point Logic based on Poin.php:
    1. Points awarded if jenis_beli = 'kacamata' AND has payment (total_bayar > 0)
    2. Lookup rule_poin where amount ranges matches nominal and nominal_end
    3. Subtract points used from bayar_point
  */
  const sql = `
    SELECT 
        c.kode_customer, 
        c.kode_qr, 
        c.nama_customer, 
        c.no_hp,
        c.status_user AS status_user,
        COUNT(DISTINCT t.id_transaksi) AS total_trx,
        COALESCE(SUM(COALESCE(rp.poin, 0)), 0) AS total_spent,
        COALESCE(bp_total.total_used, 0) AS total_used,
        (COALESCE(SUM(COALESCE(rp.poin, 0)), 0) - COALESCE(bp_total.total_used, 0)) AS current_points
    FROM transaksi t
    JOIN customer c ON c.kode_customer = t.kode_customer
    LEFT JOIN (
        SELECT kode_transaksi, SUM(jumlah_bayar + IFNULL(bayar_lain, 0) + IFNULL(potong_marketing, 0)) as total_paid 
        FROM transaksi_pembayaran 
        GROUP BY kode_transaksi
    ) tp ON tp.kode_transaksi = t.kode_transaksi
    LEFT JOIN rule_poin rp ON (
        CASE WHEN t.harga_nego > 0 THEN t.harga_nego ELSE t.total_harga END
    ) BETWEEN rp.nominal AND rp.nominal_end
    LEFT JOIN (
        SELECT kode_customer, SUM(point_use) as total_used 
        FROM bayar_point 
        GROUP BY kode_customer
    ) bp_total ON bp_total.kode_customer = c.kode_customer
    ${where}
    AND t.jenis_beli = 'kacamata'
    AND tp.total_paid IS NOT NULL
    AND tp.total_paid > 0
    GROUP BY c.kode_customer, c.kode_qr, c.nama_customer, c.no_hp, bp_total.total_used
    ORDER BY current_points DESC
    LIMIT ? OFFSET ?
  `

  const sqlCount = `
    SELECT COUNT(DISTINCT t.kode_customer) AS total
    FROM transaksi t
    JOIN customer c ON c.kode_customer = t.kode_customer
    LEFT JOIN (SELECT kode_transaksi, SUM(jumlah_bayar + IFNULL(bayar_lain, 0) + IFNULL(potong_marketing, 0)) as total_paid FROM transaksi_pembayaran GROUP BY kode_transaksi) tp ON tp.kode_transaksi = t.kode_transaksi
    ${where}
    AND t.jenis_beli = 'kacamata'
    AND tp.total_paid IS NOT NULL
    AND tp.total_paid > 0
  `

  const [rows] = await pool.query(sql, [...params, Number(limit), Number(offset)])
  const [countRows] = await pool.query(sqlCount, params)
  const total = Number(countRows?.[0]?.total || 0)

  console.log('[fetchBestCustomersV2] returned', rows.length, 'rows, total:', total)

  return { data: rows, total }
}

export async function fetchVoucherPayments({ pembukuanId, cabangId, page = 1, limit = 20, q }) {
  let where = 'WHERE 1=1'
  const params = []

  if (pembukuanId) {
    const active = await getActivePembukuan(pembukuanId)
    if (active) {
      where += ' AND svu.tanggal_use BETWEEN ? AND ?'
      params.push(active.tanggal_buka_buku, active.tanggal_tutup_buku)
    }
  }

  const offset = Math.max(0, (Number(page) - 1) * Number(limit))

  if (cabangId) { where += ' AND t.id_cabang = ?'; params.push(cabangId) }
  if (q) {
    where += ' AND (t.kode_transaksi LIKE ? OR c.nama_customer LIKE ?)'
    const like = `%${q}%`
    params.push(like, like)
  }

  const sql = `
    SELECT svu.tanggal_use, svu.voucher_use,
           t.kode_transaksi, t.id_transaksi,
           c.nama_customer,
           ct.nama_cabang,
           a.nama_lengkap AS nama_marketing
    FROM sponsor_voucher_use svu
    JOIN transaksi t ON t.kode_transaksi = svu.kode_transaksi
    LEFT JOIN customer c ON c.kode_customer = svu.kode_customer
    LEFT JOIN cabang_toko ct ON ct.id_cabang = t.id_cabang
    LEFT JOIN admin a ON a.id = t.id_marketing
    ${where}
    ORDER BY svu.tanggal_use DESC
    LIMIT ? OFFSET ?
  `

  const sqlCount = `
    SELECT COUNT(*) AS total
    FROM sponsor_voucher_use svu
    JOIN transaksi t ON t.kode_transaksi = svu.kode_transaksi
    LEFT JOIN customer c ON c.kode_customer = svu.kode_customer
    ${where}
  `

  const [rows] = await pool.query(sql, [...params, Number(limit), Number(offset)])
  const [countRows] = await pool.query(sqlCount, params)
  const total = Number(countRows?.[0]?.total || 0)

  return { data: rows, total }
}

export async function fetchSponsors({ cabangId, marketingId, page = 1, limit = 20, q }) {
  const offset = Math.max(0, (Number(page) - 1) * Number(limit))
  const params = []

  let where = 'WHERE 1=1'

  if (cabangId) { where += ' AND c.cabang = ?'; params.push(cabangId) }
  if (marketingId) { where += ' AND c.id_marketing = ?'; params.push(marketingId) }
  if (q) {
    where += ' AND (c.kode_customer LIKE ? OR c.nama_customer LIKE ? OR c.no_hp LIKE ?)'
    const like = `%${q}%`
    params.push(like, like, like)
  }

  const sql = `
    SELECT
      c.kode_customer, c.nama_customer, c.no_hp,
      admin.nama_lengkap AS nama_marketing,
      cabang_toko.nama_cabang,
      COALESCE(st_agg.total_earned, 0) AS total_earned,
      COALESCE(svu_agg.total_used, 0) AS total_used,
      COALESCE(own_voucher.voucher_for_payment, 0) AS voucher_for_payment,
      (COALESCE(st_agg.total_earned, 0) - COALESCE(svu_agg.total_used, 0)) AS balance,
      st_agg.last_earned_date
    FROM customer c
    INNER JOIN (
      SELECT kode_customer, SUM(voucher_get) as total_earned, MAX(created_at) as last_earned_date
      FROM sponsor_transaksi
      GROUP BY kode_customer
    ) st_agg ON st_agg.kode_customer = c.kode_customer
    LEFT JOIN (
      SELECT kode_customer, SUM(voucher_use) as total_used
      FROM sponsor_voucher_use
      GROUP BY kode_customer
    ) svu_agg ON svu_agg.kode_customer = c.kode_customer
    LEFT JOIN (
      SELECT t.kode_customer, SUM(svu.voucher_use) as voucher_for_payment
      FROM sponsor_voucher_use svu
      INNER JOIN transaksi t ON t.kode_transaksi = svu.kode_transaksi
      GROUP BY t.kode_customer
    ) own_voucher ON own_voucher.kode_customer = c.kode_customer
    LEFT JOIN admin ON admin.id = c.id_marketing
    LEFT JOIN cabang_toko ON cabang_toko.id_cabang = c.cabang
    ${where}
    ORDER BY balance DESC, total_earned DESC
    LIMIT ? OFFSET ?
  `

  const sqlCount = `
    SELECT COUNT(DISTINCT c.kode_customer) AS total
    FROM customer c
    INNER JOIN (
      SELECT kode_customer FROM sponsor_transaksi GROUP BY kode_customer
    ) st_agg ON st_agg.kode_customer = c.kode_customer
    ${where}
  `

  const [rows] = await pool.query(sql, [...params, Number(limit), Number(offset)])
  const [countRows] = await pool.query(sqlCount, params)
  const total = Number(countRows?.[0]?.total || 0)

  return { data: rows, total }
}

export async function fetchSponsorsByMarketing({ cabangId, page = 1, limit = 20, q }) {
  const offset = Math.max(0, (Number(page) - 1) * Number(limit))
  const params = []

  let where = 'WHERE 1=1'

  if (cabangId) { where += ' AND c.cabang = ?'; params.push(cabangId) }
  if (q) {
    where += ' AND (admin.nama_lengkap LIKE ?)'
    const like = `%${q}%`
    params.push(like)
  }

  const sql = `
    SELECT
      c.id_marketing,
      admin.nama_lengkap AS nama_marketing,
      cabang_toko.nama_cabang,
      COUNT(DISTINCT c.kode_customer) AS total_sponsors,
      SUM(COALESCE(st_agg.total_earned, 0)) AS total_earned,
      SUM(COALESCE(svu_agg.total_used, 0)) AS total_used,
      SUM(COALESCE(own_voucher.voucher_for_payment, 0)) AS total_voucher_for_payment,
      SUM(COALESCE(st_agg.total_earned, 0) - COALESCE(svu_agg.total_used, 0)) AS total_balance
    FROM customer c
    INNER JOIN (
      SELECT kode_customer, SUM(voucher_get) as total_earned
      FROM sponsor_transaksi
      GROUP BY kode_customer
    ) st_agg ON st_agg.kode_customer = c.kode_customer
    LEFT JOIN (
      SELECT kode_customer, SUM(voucher_use) as total_used
      FROM sponsor_voucher_use
      GROUP BY kode_customer
    ) svu_agg ON svu_agg.kode_customer = c.kode_customer
    LEFT JOIN (
      SELECT t.kode_customer, SUM(svu.voucher_use) as voucher_for_payment
      FROM sponsor_voucher_use svu
      INNER JOIN transaksi t ON t.kode_transaksi = svu.kode_transaksi
      GROUP BY t.kode_customer
    ) own_voucher ON own_voucher.kode_customer = c.kode_customer
    LEFT JOIN admin ON admin.id = c.id_marketing
    LEFT JOIN cabang_toko ON cabang_toko.id_cabang = c.cabang
    ${where}
    GROUP BY c.id_marketing, admin.nama_lengkap, cabang_toko.nama_cabang
    ORDER BY total_balance DESC
    LIMIT ? OFFSET ?
  `

  const sqlCount = `
      SELECT COUNT(DISTINCT c.id_marketing) as total
      FROM customer c
      INNER JOIN (
        SELECT kode_customer FROM sponsor_transaksi GROUP BY kode_customer
      ) st_agg ON st_agg.kode_customer = c.kode_customer
      LEFT JOIN admin ON admin.id = c.id_marketing
      ${where}
  `

  const [rows] = await pool.query(sql, [...params, Number(limit), Number(offset)])
  const [countRows] = await pool.query(sqlCount, params)
  const total = Number(countRows?.[0]?.total || 0)

  return { data: rows, total }
}

/**
 * Fetch the list of customers sponsored by a specific sponsor (kode_customer)
 */
export async function fetchSponsoredChildren({ sponsorKode }) {
  const sql = `
    SELECT
      c.kode_customer,
      c.nama_customer,
      c.no_hp,
      st.kode_transaksi,
      st.tanggal_transaksi,
      st.voucher_get
    FROM sponsor_transaksi st
    INNER JOIN transaksi t ON t.kode_transaksi = st.kode_transaksi
    INNER JOIN customer c ON c.kode_customer = t.kode_customer
    WHERE st.kode_customer = ?
    ORDER BY st.tanggal_transaksi DESC
  `
  const [rows] = await pool.query(sql, [sponsorKode])
  return rows
}


export async function fetchTransactionFullDetails(kode) {
  const [headers] = await pool.query(
    `SELECT t.*, 
            c.nama_customer, c.no_hp, c.alamat_lengkap, c.kode_customer, 
            a.nama_lengkap AS nama_marketing, 
            cb.nama_cabang
     FROM transaksi t
     LEFT JOIN customer c ON c.kode_customer = t.kode_customer
     LEFT JOIN admin a ON a.id = t.id_marketing
     LEFT JOIN cabang_toko cb ON cb.id_cabang = t.id_cabang
     WHERE t.kode_transaksi = ? OR t.id_transaksi = ?`,
    [kode, kode]
  )
  const header = headers?.[0] || null

  let items = []
  let payments = []
  let vouchers = []

  if (header) {
    const k = header.kode_transaksi;

    // Items
    const [i] = await pool.query(
      `SELECT tl.*,
               CASE 
                   WHEN tl.jenis_produk = 'katalog' THEN (SELECT nama_produk FROM produk WHERE produk.id_produk = tl.id_produk)
                   WHEN tl.jenis_produk = 'frame' THEN (SELECT sku_frame FROM frame WHERE frame.id_frame = tl.id_produk)
                   WHEN tl.jenis_produk = 'lensa' THEN (SELECT sku_lensa FROM lensa WHERE lensa.id_lensa = tl.id_produk)
                   WHEN tl.jenis_produk = 'softlens' THEN (SELECT nama_softlens FROM softlens WHERE softlens.id_softlens = tl.id_produk)
                   ELSE tl.jenis_produk
               END AS nama_produk_resolved
        FROM transaksi_log tl
        WHERE tl.id_grosir = ? OR tl.id_grosir = (SELECT id_transaksi FROM transaksi WHERE kode_transaksi = ?)
        ORDER BY tl.id_sg_log ASC`,
      [k, k]
    )
    items = i

    // Payments
    const [p] = await pool.query(
      `SELECT * FROM transaksi_pembayaran WHERE kode_transaksi = ? ORDER BY tanggal_bayar ASC`,
      [k]
    )
    payments = p

    // Vouchers
    const [v] = await pool.query(
      `SELECT svu.*, t.total_harga, a.nama_lengkap AS marketing
       FROM sponsor_voucher_use svu
       LEFT JOIN transaksi t ON t.kode_transaksi = svu.kode_transaksi
       LEFT JOIN admin a ON a.id = t.id_marketing
       WHERE svu.kode_transaksi = ?
       ORDER BY svu.tanggal_use ASC`,
      [k]
    )
    vouchers = v
  }

  const voucher_used = vouchers.reduce((sum, v) => sum + Number(v.voucher_use || 0), 0)

  return { header, items, payments, vouchers, voucher_used }
}

export async function fetchPointUsage({ pembukuanId, page = 1, limit = 50, q }) {
  let active = null
  if (pembukuanId) {
    active = await getActivePembukuan(pembukuanId)
  }

  const offset = Math.max(0, (Number(page) - 1) * Number(limit))
  const paramsWhere = []
  let where = 'WHERE 1=1'

  if (active) {
    where += ' AND bp.tanggal_penggunaan BETWEEN ? AND ?'
    paramsWhere.push(active.tanggal_buka_buku, active.tanggal_tutup_buku)
  }

  if (q) {
    where += ' AND (bp.kode_transaksi LIKE ? OR c.nama_customer LIKE ? OR c.kode_customer LIKE ?)'
    const like = `%${q}%`
    paramsWhere.push(like, like, like)
  }

  const sqlData = `
    SELECT 
      bp.*,
      c.nama_customer,
      c.no_hp,
      t.total_harga as nominal_transaksi,
      t.jenis_beli,
      ct.nama_cabang,
      a.nama_lengkap as nama_sales
    FROM bayar_point bp
    LEFT JOIN customer c ON c.kode_customer = bp.kode_customer
    LEFT JOIN transaksi t ON t.kode_transaksi = bp.kode_transaksi
    LEFT JOIN admin a ON a.id = t.id_marketing
    LEFT JOIN cabang_toko ct ON ct.id_cabang = t.id_cabang
    ${where}
    ORDER BY bp.tanggal_penggunaan DESC, bp.id DESC
    LIMIT ? OFFSET ?
  `

  const sqlCount = `
    SELECT COUNT(*) as total, SUM(bp.point_use) as total_points
    FROM bayar_point bp
    LEFT JOIN customer c ON c.kode_customer = bp.kode_customer
    LEFT JOIN transaksi t ON t.kode_transaksi = bp.kode_transaksi
    ${where}
  `

  const [rows] = await pool.query(sqlData, [...paramsWhere, Number(limit), Number(offset)])
  const [countRows] = await pool.query(sqlCount, paramsWhere)

  return {
    data: rows,
    total: Number(countRows?.[0]?.total || 0),
    summary: {
      total_points_used: Number(countRows?.[0]?.total_points || 0)
    }
  }
}

export async function fetchVoucherPaymentsList({ cabangId, page = 1, limit = 20, q, status = 'pending' }) {
  let where = "WHERE tp.voucher > 0"
  const params = []

  if (status && status !== 'all') {
    where += " AND tp.status_bayar = ?"
    params.push(status)
  }

  const offset = Math.max(0, (Number(page) - 1) * Number(limit))

  if (cabangId) {
    where += ' AND t.id_cabang = ?'
    params.push(cabangId)
  }
  if (q) {
    where += ' AND (t.kode_transaksi LIKE ? OR c.nama_customer LIKE ?)'
    const like = `%${q}%`
    params.push(like, like)
  }

  const sql = `
    SELECT tp.id_pembayaran, tp.kode_transaksi, tp.jumlah_bayar, tp.voucher, tp.tanggal_bayar, tp.status_bayar,
           c.nama_customer, c.kode_customer,
           ct.nama_cabang,
           a.nama_lengkap AS nama_marketing,
           t.id_marketing
    FROM transaksi_pembayaran tp
    JOIN transaksi t ON t.kode_transaksi = tp.kode_transaksi
    LEFT JOIN customer c ON c.kode_customer = t.kode_customer
    LEFT JOIN cabang_toko ct ON ct.id_cabang = t.id_cabang
    LEFT JOIN admin a ON a.id = t.id_marketing
    ${where}
    ORDER BY tp.tanggal_bayar DESC, tp.id_pembayaran DESC
    LIMIT ? OFFSET ?
  `

  const sqlCount = `
    SELECT COUNT(*) AS total,
           SUM(tp.voucher) AS total_voucher,
           SUM(tp.jumlah_bayar) AS total_cash
    FROM transaksi_pembayaran tp
    JOIN transaksi t ON t.kode_transaksi = tp.kode_transaksi
    LEFT JOIN customer c ON c.kode_customer = t.kode_customer
    ${where}
  `

  const [rows] = await pool.query(sql, [...params, Number(limit), Number(offset)])
  const [countRows] = await pool.query(sqlCount, params)
  const total = Number(countRows?.[0]?.total || 0)
  const summary = {
    total_voucher: Number(countRows?.[0]?.total_voucher || 0),
    total_cash: Number(countRows?.[0]?.total_cash || 0)
  }

  return { data: rows, total, summary }
}

export async function rollbackVoucherPayment(id_pembayaran) {
  const [payRows] = await pool.query('SELECT * FROM transaksi_pembayaran WHERE id_pembayaran = ?', [id_pembayaran])
  const bayar = payRows[0]
  if (!bayar) throw new Error('Pembayaran tidak ditemukan')

  // Allow rollback for 'ok' and 'rejected' to support full cycle (Pending <-> Approved/Rejected)
  if (bayar.status_bayar !== 'ok' && bayar.status_bayar !== 'rejected') {
    throw new Error('Hanya pembayaran Approved atau Rejected yang bisa dikembalikan ke Pending')
  }

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    // 1. Update status kembali ke pending
    await connection.query('UPDATE transaksi_pembayaran SET status_bayar = ? WHERE id_pembayaran = ?', ['pending', id_pembayaran])

    // Only if it was 'ok' (Approved), we need to revert the balance and delete voucher usage
    if (bayar.status_bayar === 'ok') {
      // 2. Kurangi jumlah_bayar di transaksi (undo penambahan cash + voucher)
      // Ini "menambah lagi jumlah biaya transaksi" (tagihan) karena jumlah yang dibayar berkurang.
      const [trxRows] = await connection.query('SELECT jumlah_bayar FROM transaksi WHERE kode_transaksi = ?', [bayar.kode_transaksi])
      const trx = trxRows[0]
      if (trx) {
        const deduction = Number(bayar.voucher || 0) + Number(bayar.jumlah_bayar || 0)
        const newTotal = Math.max(0, (Number(trx.jumlah_bayar) || 0) - deduction)
        await connection.query('UPDATE transaksi SET jumlah_bayar = ? WHERE kode_transaksi = ?', [newTotal, bayar.kode_transaksi])
      }

      // 3. Hapus penggunaan voucher di sponsor_voucher_use
      await connection.query('DELETE FROM sponsor_voucher_use WHERE id_pembayaran = ?', [id_pembayaran])
    }

    await connection.commit()
    return true
  } catch (e) {
    await connection.rollback()
    throw e
  } finally {
    connection.release()
  }
}

export async function approveVoucherPayment(id_pembayaran) {
  const [payRows] = await pool.query('SELECT * FROM transaksi_pembayaran WHERE id_pembayaran = ?', [id_pembayaran])
  const bayar = payRows[0]
  if (!bayar) throw new Error('Pembayaran tidak ditemukan')
  if (bayar.status_bayar !== 'pending') throw new Error('Pembayaran sudah di-approve atau status tidak valid')
  if (Number(bayar.voucher) <= 0) throw new Error('Pembayaran ini tidak menggunakan voucher')

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    // 1. Set status bayar menjadi ok
    await connection.query('UPDATE transaksi_pembayaran SET status_bayar = ? WHERE id_pembayaran = ?', ['ok', id_pembayaran])

    // 2. Tambahkan voucher DAN cash ke jumlah_bayar transaksi
    // (sesuai logic di Marketing.php, karena saat bayar pending tdk diupdate)
    const [trxRows] = await connection.query('SELECT jumlah_bayar, kode_customer, id_marketing FROM transaksi WHERE kode_transaksi = ?', [bayar.kode_transaksi])
    const trx = trxRows[0]
    if (trx) {
      const newTotalBayar = (Number(trx.jumlah_bayar) || 0) + Number(bayar.voucher || 0) + Number(bayar.jumlah_bayar || 0)
      await connection.query('UPDATE transaksi SET jumlah_bayar = ? WHERE kode_transaksi = ?', [newTotalBayar, bayar.kode_transaksi])
    }

    // 3. Catat penggunaan voucher
    const dataUse = {
      id_pembayaran: id_pembayaran,
      kode_customer: trx?.kode_customer || null,
      id_marketing: bayar.id_marketing || trx?.id_marketing || null,
      kode_transaksi: bayar.kode_transaksi,
      tanggal_use: new Date().toISOString().slice(0, 10),
      voucher_use: bayar.voucher
    }
    await connection.query('INSERT INTO sponsor_voucher_use SET ?', [dataUse])

    await connection.commit()
    return true
  } catch (e) {
    await connection.rollback()
    throw e
  } finally {
    connection.release()
  }
}

export async function rejectVoucherPayment(id_pembayaran) {
  const [payRows] = await pool.query('SELECT status_bayar FROM transaksi_pembayaran WHERE id_pembayaran = ?', [id_pembayaran])
  const bayar = payRows[0]
  if (!bayar) throw new Error('Pembayaran tidak ditemukan')
  if (bayar.status_bayar !== 'pending') throw new Error('Pembayaran sudah diproses')

  // Set status menjadi rejected. Balance tetap tidak berubah (karena status pending memang tdk merubah balance)
  await pool.query('UPDATE transaksi_pembayaran SET status_bayar = ? WHERE id_pembayaran = ?', ['rejected', id_pembayaran])
  return true
}
