import { pool } from '../db.js'
import { getActivePembukuan } from './pembukuanService.js'

export async function fetchProductTransactionsPage({ jenis, productId, cabangId, page = 1, limit = 20, pembukuanId, all, split = false, page_mkt, limit_mkt, page_toko, limit_toko }){
  const j = String(jenis||'').toLowerCase()
  const allowed = new Set(['katalog','softlens','frame','lensa'])
  if(!allowed.has(j)) throw new Error('jenis invalid')
  const pid = Number(productId)
  if(!Number.isFinite(pid)) throw new Error('productId invalid')
  const offset = Math.max(0, (Number(page) - 1) * Number(limit))
  const active = Number.isInteger(pembukuanId) ? await getActivePembukuan(pembukuanId) : null
  const usePeriod = !!active && String(all) !== '1'
  const periodWhereT = usePeriod ? ' AND t.tanggal_order BETWEEN ? AND ?' : ''
  const periodParamsT = usePeriod ? [active.tanggal_buka_buku, active.tanggal_tutup_buku] : []
  const periodWhereG = usePeriod ? ' AND gl.tanggal_log BETWEEN ? AND ?' : ''
  const periodParamsG = usePeriod ? [active.tanggal_buka_buku, active.tanggal_tutup_buku] : []

  const paramsT = []
  const paramsG = []
  let whereCabangT = ''
  let whereCabangT2 = ''
  let whereCabangG = ''
  if (cabangId) { whereCabangT = ' AND cabang_toko.id_cabang = ?'; paramsT.push(cabangId) }
  if (cabangId) { whereCabangT2 = ' AND cabang_toko.id_cabang = ?'; paramsT.push(cabangId) }
  if (cabangId) { whereCabangG = ' AND g.id_cabang = ?'; paramsG.push(cabangId) }

  let sqlMarketing = ''
  if (j === 'katalog'){
    sqlMarketing = `
      SELECT t.id_transaksi AS sort_id,
             t.id_transaksi AS id_grosir,
             t.kode_transaksi,
             c.nama_customer,
             COALESCE(admin.nama_lengkap, '-') AS nama_lengkap,
             cabang_toko.nama_cabang,
             'katalog' AS jenis_produk,
             tb.qty AS jumlah, tb.id_produk,
             (SELECT harga_jual FROM produk WHERE produk.id_produk = tb.id_produk) AS harga_produk,
             ((SELECT harga_jual FROM produk WHERE produk.id_produk = tb.id_produk) * tb.qty) AS jumlah_harga,
             t.tanggal_order AS tanggal_log,
             (SELECT harga_modal FROM produk WHERE produk.id_produk = tb.id_produk) AS harga_modal,
             ((SELECT harga_modal FROM produk WHERE produk.id_produk = tb.id_produk) * tb.qty) AS jumlah_modal,
             (SELECT harga_ongkir FROM produk WHERE produk.id_produk = tb.id_produk) AS harga_ongkir,
             ((SELECT harga_ongkir FROM produk WHERE produk.id_produk = tb.id_produk) * tb.qty) AS jumlah_ongkir,
             (((SELECT harga_jual FROM produk WHERE produk.id_produk = tb.id_produk) * tb.qty)
               - ((SELECT harga_modal FROM produk WHERE produk.id_produk = tb.id_produk) * tb.qty)
               - ((SELECT harga_ongkir FROM produk WHERE produk.id_produk = tb.id_produk) * tb.qty)) AS laba_item
        FROM transaksi_barang tb
          LEFT JOIN transaksi t ON t.kode_transaksi = tb.kode_transaksi
          LEFT JOIN customer c ON c.kode_customer = t.kode_customer
          LEFT JOIN admin ON admin.id = t.id_marketing
          LEFT JOIN cabang_toko ON cabang_toko.id_cabang = t.id_cabang
        WHERE tb.id_produk = ?${whereCabangT}${periodWhereT}
        UNION ALL
        SELECT COALESCE(t2id.id_transaksi, t2kode.id_transaksi) AS sort_id,
               COALESCE(t2id.id_transaksi, t2kode.id_transaksi) AS id_grosir,
               COALESCE(t2id.kode_transaksi, t2kode.kode_transaksi, g2.kode_grosir, '-') AS kode_transaksi,
               COALESCE(c.nama_customer, c2.nama_customer, '-') AS nama_customer,
               COALESCE(admin.nama_lengkap, '-') AS nama_lengkap,
               COALESCE(cabang_toko.nama_cabang, cab2.nama_cabang, '-') AS nama_cabang,
               'katalog' AS jenis_produk,
               tl.jumlah AS jumlah, tl.id_produk,
               tl.harga_produk,
               tl.jumlah_harga,
               tl.tanggal_log,
               (SELECT harga_modal FROM produk WHERE produk.id_produk = tl.id_produk) AS harga_modal,
               ((SELECT harga_modal FROM produk WHERE produk.id_produk = tl.id_produk) * tl.jumlah) AS jumlah_modal,
               (SELECT harga_ongkir FROM produk WHERE produk.id_produk = tl.id_produk) AS harga_ongkir,
               ((SELECT harga_ongkir FROM produk WHERE produk.id_produk = tl.id_produk) * tl.jumlah) AS jumlah_ongkir,
               ((CASE WHEN tl.jumlah_harga = 0 THEN (tl.harga_produk * tl.jumlah) ELSE tl.jumlah_harga END)
                 - ((SELECT harga_modal FROM produk WHERE produk.id_produk = tl.id_produk) * tl.jumlah)
                 - ((SELECT harga_ongkir FROM produk WHERE produk.id_produk = tl.id_produk) * tl.jumlah)) AS laba_item
          FROM transaksi_log tl
            LEFT JOIN transaksi t2id ON t2id.id_transaksi = tl.id_grosir
            LEFT JOIN transaksi t2kode ON t2kode.kode_transaksi = tl.id_grosir
            LEFT JOIN customer c ON c.kode_customer = COALESCE(t2id.kode_customer, t2kode.kode_customer)
            LEFT JOIN admin ON admin.id = COALESCE(t2id.id_marketing, t2kode.id_marketing)
            LEFT JOIN cabang_toko ON cabang_toko.id_cabang = COALESCE(t2id.id_cabang, t2kode.id_cabang)
            LEFT JOIN grosir g2 ON g2.kode_grosir = tl.id_grosir
            LEFT JOIN customer c2 ON c2.kode_customer = g2.kode_customer
            LEFT JOIN cabang_toko cab2 ON cab2.id_cabang = g2.id_cabang
          WHERE tl.jenis_produk='katalog' AND tl.id_produk = ?${whereCabangT2}${usePeriod ? ' AND tl.tanggal_log BETWEEN ? AND ?' : ''}
    `
    paramsT.unshift(pid, pid)
  } else if (j === 'softlens'){
    sqlMarketing = `
      SELECT t.id_transaksi AS sort_id,
             t.id_transaksi AS id_grosir,
             t.kode_transaksi,
             c.nama_customer,
             COALESCE(admin.nama_lengkap, '-') AS nama_lengkap,
             cabang_toko.nama_cabang,
             'softlens' AS jenis_produk,
             ts.qty AS jumlah, ts.id_produk,
             (SELECT harga_jual FROM softlens WHERE softlens.id_softlens = ts.id_produk) AS harga_produk,
             ((SELECT harga_jual FROM softlens WHERE softlens.id_softlens = ts.id_produk) * ts.qty) AS jumlah_harga,
             t.tanggal_order AS tanggal_log,
             (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = ts.id_produk) AS harga_modal,
             ((SELECT harga_modal FROM softlens WHERE softlens.id_softlens = ts.id_produk) * ts.qty) AS jumlah_modal,
             (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = ts.id_produk) AS harga_ongkir,
             ((SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = ts.id_produk) * ts.qty) AS jumlah_ongkir,
             (((SELECT harga_jual FROM softlens WHERE softlens.id_softlens = ts.id_produk) * ts.qty)
               - ((SELECT harga_modal FROM softlens WHERE softlens.id_softlens = ts.id_produk) * ts.qty)
               - ((SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = ts.id_produk) * ts.qty)) AS laba_item
        FROM transaksi_barang ts
          LEFT JOIN transaksi t ON t.kode_transaksi = ts.kode_transaksi
          LEFT JOIN customer c ON c.kode_customer = t.kode_customer
          LEFT JOIN admin ON admin.id = t.id_marketing
          LEFT JOIN cabang_toko ON cabang_toko.id_cabang = t.id_cabang
        WHERE ts.id_produk = ?${whereCabangT}${periodWhereT}
        UNION ALL
        SELECT COALESCE(t2id.id_transaksi, t2kode.id_transaksi) AS sort_id,
               COALESCE(t2id.id_transaksi, t2kode.id_transaksi) AS id_grosir,
               COALESCE(t2id.kode_transaksi, t2kode.kode_transaksi, g2.kode_grosir, '-') AS kode_transaksi,
               COALESCE(c.nama_customer, c2.nama_customer, '-') AS nama_customer,
               COALESCE(admin.nama_lengkap, '-') AS nama_lengkap,
               COALESCE(cabang_toko.nama_cabang, cab2.nama_cabang, '-') AS nama_cabang,
               'softlens' AS jenis_produk,
               tl.jumlah AS jumlah, tl.id_produk,
               tl.harga_produk,
               tl.jumlah_harga,
               tl.tanggal_log,
               (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = tl.id_produk) AS harga_modal,
               ((SELECT harga_modal FROM softlens WHERE softlens.id_softlens = tl.id_produk) * tl.jumlah) AS jumlah_modal,
               (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = tl.id_produk) AS harga_ongkir,
               ((SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = tl.id_produk) * tl.jumlah) AS jumlah_ongkir,
               ((CASE WHEN tl.jumlah_harga = 0 THEN (tl.harga_produk * tl.jumlah) ELSE tl.jumlah_harga END)
                 - ((SELECT harga_modal FROM softlens WHERE softlens.id_softlens = tl.id_produk) * tl.jumlah)
                 - ((SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = tl.id_produk) * tl.jumlah)) AS laba_item
          FROM transaksi_log tl
            LEFT JOIN transaksi t2id ON t2id.id_transaksi = tl.id_grosir
            LEFT JOIN transaksi t2kode ON t2kode.kode_transaksi = tl.id_grosir
            LEFT JOIN customer c ON c.kode_customer = COALESCE(t2id.kode_customer, t2kode.kode_customer)
            LEFT JOIN admin ON admin.id = COALESCE(t2id.id_marketing, t2kode.id_marketing)
            LEFT JOIN cabang_toko ON cabang_toko.id_cabang = COALESCE(t2id.id_cabang, t2kode.id_cabang)
            LEFT JOIN grosir g2 ON g2.kode_grosir = tl.id_grosir
            LEFT JOIN customer c2 ON c2.kode_customer = g2.kode_customer
            LEFT JOIN cabang_toko cab2 ON cab2.id_cabang = g2.id_cabang
          WHERE tl.jenis_produk='softlens' AND tl.id_produk = ?${whereCabangT2}${usePeriod ? ' AND tl.tanggal_log BETWEEN ? AND ?' : ''}
    `
    paramsT.unshift(pid, pid)
  } else if (j === 'frame'){
    sqlMarketing = `
      SELECT t.id_transaksi AS sort_id,
             t.id_transaksi AS id_grosir,
             t.kode_transaksi,
             c.nama_customer,
             COALESCE(admin.nama_lengkap, '-') AS nama_lengkap,
             cabang_toko.nama_cabang,
             'frame' AS jenis_produk,
             tf.qty AS jumlah, tf.id_frame AS id_produk,
             (SELECT harga_jual FROM frame WHERE frame.id_frame = tf.id_frame) AS harga_produk,
             ((SELECT harga_jual FROM frame WHERE frame.id_frame = tf.id_frame) * tf.qty) AS jumlah_harga,
             t.tanggal_order AS tanggal_log,
             (SELECT harga_modal FROM frame WHERE frame.id_frame = tf.id_frame) AS harga_modal,
             ((SELECT harga_modal FROM frame WHERE frame.id_frame = tf.id_frame) * tf.qty) AS jumlah_modal,
             (SELECT harga_ongkir FROM frame WHERE frame.id_frame = tf.id_frame) AS harga_ongkir,
             ((SELECT harga_ongkir FROM frame WHERE frame.id_frame = tf.id_frame) * tf.qty) AS jumlah_ongkir,
             (((SELECT harga_jual FROM frame WHERE frame.id_frame = tf.id_frame) * tf.qty)
               - ((SELECT harga_modal FROM frame WHERE frame.id_frame = tf.id_frame) * tf.qty)
               - ((SELECT harga_ongkir FROM frame WHERE frame.id_frame = tf.id_frame) * tf.qty)) AS laba_item
        FROM transaksi_frame tf
          LEFT JOIN transaksi t ON t.kode_transaksi = tf.kode_transaksi
          LEFT JOIN customer c ON c.kode_customer = t.kode_customer
          LEFT JOIN admin ON admin.id = t.id_marketing
          LEFT JOIN cabang_toko ON cabang_toko.id_cabang = t.id_cabang
        WHERE tf.id_frame = ?${whereCabangT}${periodWhereT}
        UNION ALL
        SELECT COALESCE(t2id.id_transaksi, t2kode.id_transaksi) AS sort_id,
               COALESCE(t2id.id_transaksi, t2kode.id_transaksi) AS id_grosir,
               COALESCE(t2id.kode_transaksi, t2kode.kode_transaksi, g2.kode_grosir, '-') AS kode_transaksi,
               COALESCE(c.nama_customer, c2.nama_customer, '-') AS nama_customer,
               COALESCE(admin.nama_lengkap, '-') AS nama_lengkap,
               COALESCE(cabang_toko.nama_cabang, cab2.nama_cabang, '-') AS nama_cabang,
               'frame' AS jenis_produk,
               tl.jumlah AS jumlah, tl.id_produk,
               tl.harga_produk,
               tl.jumlah_harga,
               tl.tanggal_log,
               (SELECT harga_modal FROM frame WHERE frame.id_frame = tl.id_produk) AS harga_modal,
               ((SELECT harga_modal FROM frame WHERE frame.id_frame = tl.id_produk) * tl.jumlah) AS jumlah_modal,
               (SELECT harga_ongkir FROM frame WHERE frame.id_frame = tl.id_produk) AS harga_ongkir,
               ((SELECT harga_ongkir FROM frame WHERE frame.id_frame = tl.id_produk) * tl.jumlah) AS jumlah_ongkir,
               ((CASE WHEN tl.jumlah_harga = 0 THEN (tl.harga_produk * tl.jumlah) ELSE tl.jumlah_harga END)
                 - ((SELECT harga_modal FROM frame WHERE frame.id_frame = tl.id_produk) * tl.jumlah)
                 - ((SELECT harga_ongkir FROM frame WHERE frame.id_frame = tl.id_produk) * tl.jumlah)) AS laba_item
          FROM transaksi_log tl
            LEFT JOIN transaksi t2id ON t2id.id_transaksi = tl.id_grosir
            LEFT JOIN transaksi t2kode ON t2kode.kode_transaksi = tl.id_grosir
            LEFT JOIN customer c ON c.kode_customer = COALESCE(t2id.kode_customer, t2kode.kode_customer)
            LEFT JOIN admin ON admin.id = COALESCE(t2id.id_marketing, t2kode.id_marketing)
            LEFT JOIN cabang_toko ON cabang_toko.id_cabang = COALESCE(t2id.id_cabang, t2kode.id_cabang)
            LEFT JOIN grosir g2 ON g2.kode_grosir = tl.id_grosir
            LEFT JOIN customer c2 ON c2.kode_customer = g2.kode_customer
            LEFT JOIN cabang_toko cab2 ON cab2.id_cabang = g2.id_cabang
          WHERE tl.jenis_produk='frame' AND tl.id_produk = ?${whereCabangT2}${usePeriod ? ' AND tl.tanggal_log BETWEEN ? AND ?' : ''}
    `
    paramsT.unshift(pid, pid)
  } else if (j === 'lensa'){
    sqlMarketing = `
      SELECT t.id_transaksi AS sort_id,
             t.id_transaksi AS id_grosir,
             t.kode_transaksi,
             c.nama_customer,
             COALESCE(admin.nama_lengkap, '-') AS nama_lengkap,
             cabang_toko.nama_cabang,
             'lensa' AS jenis_produk,
             tl.qty AS jumlah, tl.id_lensa AS id_produk,
             (SELECT harga_jual FROM lensa WHERE lensa.id_lensa = tl.id_lensa) AS harga_produk,
             ((SELECT harga_jual FROM lensa WHERE lensa.id_lensa = tl.id_lensa) * tl.qty) AS jumlah_harga,
             t.tanggal_order AS tanggal_log,
             (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = tl.id_lensa) AS harga_modal,
             ((SELECT harga_modal FROM lensa WHERE lensa.id_lensa = tl.id_lensa) * tl.qty) AS jumlah_modal,
             (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = tl.id_lensa) AS harga_ongkir,
             ((SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = tl.id_lensa) * tl.qty) AS jumlah_ongkir,
             (((SELECT harga_jual FROM lensa WHERE lensa.id_lensa = tl.id_lensa) * tl.qty)
               - ((SELECT harga_modal FROM lensa WHERE lensa.id_lensa = tl.id_lensa) * tl.qty)
               - ((SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = tl.id_lensa) * tl.qty)) AS laba_item
        FROM transaksi_lensa tl
          LEFT JOIN transaksi t ON t.kode_transaksi = tl.kode_transaksi
          LEFT JOIN customer c ON c.kode_customer = t.kode_customer
          LEFT JOIN admin ON admin.id = t.id_marketing
          LEFT JOIN cabang_toko ON cabang_toko.id_cabang = t.id_cabang
        WHERE tl.id_lensa = ?${whereCabangT}${periodWhereT}
        UNION ALL
        SELECT COALESCE(t2id.id_transaksi, t2kode.id_transaksi) AS sort_id,
               COALESCE(t2id.id_transaksi, t2kode.id_transaksi) AS id_grosir,
               COALESCE(t2id.kode_transaksi, t2kode.kode_transaksi, g2.kode_grosir, '-') AS kode_transaksi,
               COALESCE(c.nama_customer, c2.nama_customer, '-') AS nama_customer,
               COALESCE(admin.nama_lengkap, '-') AS nama_lengkap,
               COALESCE(cabang_toko.nama_cabang, cab2.nama_cabang, '-') AS nama_cabang,
               'lensa' AS jenis_produk,
               tl2.jumlah AS jumlah, tl2.id_produk,
               tl2.harga_produk,
               tl2.jumlah_harga,
               tl2.tanggal_log,
               (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = tl2.id_produk) AS harga_modal,
               ((SELECT harga_modal FROM lensa WHERE lensa.id_lensa = tl2.id_produk) * tl2.jumlah) AS jumlah_modal,
               (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = tl2.id_produk) AS harga_ongkir,
               ((SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = tl2.id_produk) * tl2.jumlah) AS jumlah_ongkir,
               ((CASE WHEN tl2.jumlah_harga = 0 THEN (tl2.harga_produk * tl2.jumlah) ELSE tl2.jumlah_harga END)
                 - ((SELECT harga_modal FROM lensa WHERE lensa.id_lensa = tl2.id_produk) * tl2.jumlah)
                 - ((SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = tl2.id_produk) * tl2.jumlah)) AS laba_item
          FROM transaksi_log tl2
            LEFT JOIN transaksi t2id ON t2id.id_transaksi = tl2.id_grosir
            LEFT JOIN transaksi t2kode ON t2kode.kode_transaksi = tl2.id_grosir
            LEFT JOIN customer c ON c.kode_customer = COALESCE(t2id.kode_customer, t2kode.kode_customer)
            LEFT JOIN admin ON admin.id = COALESCE(t2id.id_marketing, t2kode.id_marketing)
            LEFT JOIN cabang_toko ON cabang_toko.id_cabang = COALESCE(t2id.id_cabang, t2kode.id_cabang)
            LEFT JOIN grosir g2 ON g2.kode_grosir = tl2.id_grosir
            LEFT JOIN customer c2 ON c2.kode_customer = g2.kode_customer
            LEFT JOIN cabang_toko cab2 ON cab2.id_cabang = g2.id_cabang
          WHERE tl2.jenis_produk='lensa' AND tl2.id_produk = ?${whereCabangT2}${usePeriod ? ' AND tl2.tanggal_log BETWEEN ? AND ?' : ''}
    `
    paramsT.unshift(pid, pid)
  }

  const sqlToko = `
    SELECT gl.id_sg_log AS sort_id,
           gl.id_grosir,
           g.kode_grosir AS kode_transaksi,
           c.nama_customer,
           NULL AS nama_lengkap,
           cabang_toko.nama_cabang,
           gl.jenis_produk, gl.jumlah, gl.id_produk,
           gl.harga_produk, gl.jumlah_harga, gl.tanggal_log,
           (CASE 
             WHEN gl.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = gl.id_produk)
             WHEN gl.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = gl.id_produk)
             WHEN gl.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = gl.id_produk)
             WHEN gl.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = gl.id_produk)
             ELSE 0
           END) AS harga_modal,
           ((CASE 
             WHEN gl.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = gl.id_produk)
             WHEN gl.jenis_produk = 'lensa' THEN (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = gl.id_produk)
             WHEN gl.jenis_produk = 'frame' THEN (SELECT harga_modal FROM frame WHERE frame.id_frame = gl.id_produk)
             WHEN gl.jenis_produk = 'katalog' THEN (SELECT harga_modal FROM produk WHERE produk.id_produk = gl.id_produk)
             ELSE 0
           END) * gl.jumlah) AS jumlah_modal,
           (CASE 
             WHEN gl.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = gl.id_produk)
             WHEN gl.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = gl.id_produk)
             WHEN gl.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = gl.id_produk)
             WHEN gl.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = gl.id_produk)
             ELSE 0
           END) AS harga_ongkir,
           ((CASE 
             WHEN gl.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = gl.id_produk)
             WHEN gl.jenis_produk = 'lensa' THEN (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = gl.id_produk)
             WHEN gl.jenis_produk = 'frame' THEN (SELECT harga_ongkir FROM frame WHERE frame.id_frame = gl.id_produk)
             WHEN gl.jenis_produk = 'katalog' THEN (SELECT harga_ongkir FROM produk WHERE produk.id_produk = gl.id_produk)
             ELSE 0
           END) * gl.jumlah) AS jumlah_ongkir,
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
      WHERE LOWER(gl.jenis_produk) = ? AND gl.id_produk = ?${whereCabangG}${periodWhereG}
  `
  paramsG.unshift(j, pid)

  const sql = `SELECT * FROM ( ${sqlMarketing} UNION ALL ${sqlToko} ) u ORDER BY u.sort_id DESC LIMIT ? OFFSET ?`
  const marketingParams = []
  marketingParams.push(pid)
  if (cabangId) marketingParams.push(cabangId)
  if (usePeriod) marketingParams.push(...periodParamsT)
  marketingParams.push(pid)
  if (cabangId) marketingParams.push(cabangId)
  if (usePeriod) marketingParams.push(...periodParamsT)
  const tokoParams = [...paramsG, ...periodParamsG]
  if (split) {
    const lM = Number(limit_mkt || limit)
    const pM = Number(page_mkt || page)
    const oM = Math.max(0, (pM - 1) * lM)
    const lT = Number(limit_toko || limit)
    const pT = Number(page_toko || page)
    const oT = Math.max(0, (pT - 1) * lT)
    const [rowsM] = await pool.query({ sql: `${sqlMarketing} ORDER BY sort_id DESC LIMIT ? OFFSET ?`, timeout: 60000 }, [...marketingParams, lM, oM])
    const [rowsT] = await pool.query({ sql: `${sqlToko} ORDER BY sort_id DESC LIMIT ? OFFSET ?`, timeout: 60000 }, [...tokoParams, lT, oT])
    const [cntRowsM] = await pool.query({ sql: `SELECT COUNT(*) AS cnt FROM ( ${sqlMarketing} ) uu`, timeout: 60000 }, marketingParams)
    const [cntRowsT] = await pool.query({ sql: `SELECT COUNT(*) AS cnt FROM ( ${sqlToko} ) uu`, timeout: 60000 }, tokoParams)
    const totalM = Number(cntRowsM?.[0]?.cnt || 0)
    const totalT = Number(cntRowsT?.[0]?.cnt || 0)
    return {
      data_marketing: rowsM,
      meta_marketing: { page: pM, limit: lM, total: totalM, totalPages: lM>0 ? Math.ceil(totalM/lM) : 1 },
      data_toko: rowsT,
      meta_toko: { page: pT, limit: lT, total: totalT, totalPages: lT>0 ? Math.ceil(totalT/lT) : 1 }
    }
  }
  const [rows] = await pool.query({ sql, timeout: 60000 }, [...marketingParams, ...tokoParams, Number(limit), Number(offset)])

  // counts
  const sqlCntM = `SELECT COUNT(*) AS cnt FROM ( ${sqlMarketing} ) uu`
  const sqlCntG = `SELECT COUNT(*) AS cnt FROM ( ${sqlToko} ) uu`
  const [cntRowsM] = await pool.query({ sql: sqlCntM, timeout: 60000 }, marketingParams)
  const [cntRowsG] = await pool.query({ sql: sqlCntG, timeout: 60000 }, tokoParams)
  let total = Number(cntRowsM?.[0]?.cnt || 0) + Number(cntRowsG?.[0]?.cnt || 0)
  if (j === 'frame' && total === 0) {
    const fallbackSql = `
      SELECT gl.id_sg_log AS sort_id,
             gl.id_grosir,
             g.kode_grosir AS kode_transaksi,
             c.nama_customer,
             NULL AS nama_lengkap,
             cabang_toko.nama_cabang,
             'frame' AS jenis_produk,
             gl.jumlah, gl.id_produk,
             gl.harga_produk, gl.jumlah_harga, gl.tanggal_log,
             (SELECT harga_modal FROM frame WHERE frame.id_frame = gl.id_produk) AS harga_modal,
             ((SELECT harga_modal FROM frame WHERE frame.id_frame = gl.id_produk) * gl.jumlah) AS jumlah_modal,
             (SELECT harga_ongkir FROM frame WHERE frame.id_frame = gl.id_produk) AS harga_ongkir,
             ((SELECT harga_ongkir FROM frame WHERE frame.id_frame = gl.id_produk) * gl.jumlah) AS jumlah_ongkir,
             ((CASE WHEN gl.jumlah_harga = 0 THEN (gl.harga_produk * gl.jumlah) ELSE gl.jumlah_harga END)
               - ((SELECT harga_modal FROM frame WHERE frame.id_frame = gl.id_produk) * gl.jumlah)
               - ((SELECT harga_ongkir FROM frame WHERE frame.id_frame = gl.id_produk) * gl.jumlah)) AS laba_item
        FROM grosir_log gl
          LEFT JOIN grosir g ON g.kode_grosir = gl.id_grosir
          LEFT JOIN customer c ON c.kode_customer = g.kode_customer
          LEFT JOIN cabang_toko ON cabang_toko.id_cabang = g.id_cabang
        WHERE gl.jenis_produk='frame' AND gl.id_produk = ?
        ORDER BY gl.id_sg_log DESC
        LIMIT ? OFFSET ?`
    const [fallbackRows] = await pool.query({ sql: fallbackSql, timeout: 60000 }, [pid, Number(limit), Number(offset)])
    const [fallbackCnt] = await pool.query({ sql: `SELECT COUNT(*) AS cnt FROM grosir_log gl WHERE gl.jenis_produk='frame' AND gl.id_produk = ?`, timeout: 60000 }, [pid])
    total = Number(fallbackCnt?.[0]?.cnt || 0)
    return { data: fallbackRows, meta: { page, limit, total, totalPages: limit>0 ? Math.ceil(total/limit) : 1 } }
  }
  if (j === 'lensa' && total === 0) {
    const fallbackSql = `
      SELECT gl.id_sg_log AS sort_id,
             gl.id_grosir,
             g.kode_grosir AS kode_transaksi,
             c.nama_customer,
             '-' AS nama_lengkap,
             cabang_toko.nama_cabang,
             'lensa' AS jenis_produk,
             gl.jumlah, gl.id_produk,
             gl.harga_produk, gl.jumlah_harga, gl.tanggal_log,
             (SELECT harga_modal FROM lensa WHERE lensa.id_lensa = gl.id_produk) AS harga_modal,
             ((SELECT harga_modal FROM lensa WHERE lensa.id_lensa = gl.id_produk) * gl.jumlah) AS jumlah_modal,
             (SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = gl.id_produk) AS harga_ongkir,
             ((SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = gl.id_produk) * gl.jumlah) AS jumlah_ongkir,
             ((CASE WHEN gl.jumlah_harga = 0 THEN (gl.harga_produk * gl.jumlah) ELSE gl.jumlah_harga END)
               - ((SELECT harga_modal FROM lensa WHERE lensa.id_lensa = gl.id_produk) * gl.jumlah)
               - ((SELECT harga_ongkir FROM lensa WHERE lensa.id_lensa = gl.id_produk) * gl.jumlah)) AS laba_item
        FROM grosir_log gl
          LEFT JOIN grosir g ON g.kode_grosir = gl.id_grosir
          LEFT JOIN customer c ON c.kode_customer = g.kode_customer
          LEFT JOIN cabang_toko ON cabang_toko.id_cabang = g.id_cabang
        WHERE gl.jenis_produk='lensa' AND gl.id_produk = ?
        ORDER BY gl.id_sg_log DESC
        LIMIT ? OFFSET ?`
    const [fallbackRows] = await pool.query({ sql: fallbackSql, timeout: 60000 }, [pid, Number(limit), Number(offset)])
    const [fallbackCnt] = await pool.query({ sql: `SELECT COUNT(*) AS cnt FROM grosir_log gl WHERE gl.jenis_produk='lensa' AND gl.id_produk = ?`, timeout: 60000 }, [pid])
    total = Number(fallbackCnt?.[0]?.cnt || 0)
    return { data: fallbackRows, meta: { page, limit, total, totalPages: limit>0 ? Math.ceil(total/limit) : 1 } }
  }
  return { data: rows, meta: { page, limit, total, totalPages: limit>0 ? Math.ceil(total/limit) : 1 } }
}

export async function buildMasterAggForJenis({ jenis, pembukuanId }){
  const j = String(jenis||'').toLowerCase()
  const active = await getActivePembukuan(pembukuanId)
  const periodWhereT = active ? ' AND t.tanggal_order BETWEEN ? AND ?' : ''
  const periodParamsT = active ? [active.tanggal_buka_buku, active.tanggal_tutup_buku] : []
  const periodWhereG = active ? ' WHERE gl.tanggal_log BETWEEN ? AND ?' : ''
  const periodParamsG = active ? [active.tanggal_buka_buku, active.tanggal_tutup_buku] : []
  if (j === 'katalog'){
    const sql = `SELECT id_produk, SUM(sum_qty) AS sum_qty, SUM(sum_uang) AS sum_uang FROM (
      SELECT tb.id_produk, tb.qty AS sum_qty, ((SELECT harga_jual FROM produk WHERE produk.id_produk=tb.id_produk) * tb.qty) AS sum_uang FROM transaksi_barang tb LEFT JOIN transaksi t ON t.kode_transaksi = tb.kode_transaksi${periodWhereT}
      UNION ALL
      SELECT gl.id_produk, gl.jumlah AS sum_qty, gl.jumlah_harga AS sum_uang FROM grosir_log gl${periodWhereG} AND gl.jenis_produk='katalog'
    ) u GROUP BY id_produk`
    return { sql, params: [...periodParamsT, ...periodParamsG] }
  }
  if (j === 'softlens'){
    const sql = `SELECT id_produk, SUM(sum_qty) AS sum_qty, SUM(sum_uang) AS sum_uang FROM (
      SELECT ts.id_produk, ts.qty AS sum_qty, ((SELECT harga_jual FROM softlens WHERE softlens.id_softlens=ts.id_produk) * ts.qty) AS sum_uang FROM transaksi_barang ts LEFT JOIN transaksi t ON t.kode_transaksi = ts.kode_transaksi${periodWhereT}
      UNION ALL
      SELECT gl.id_produk, gl.jumlah AS sum_qty, gl.jumlah_harga AS sum_uang FROM grosir_log gl${periodWhereG} AND gl.jenis_produk='softlens'
    ) u GROUP BY id_produk`
    return { sql, params: [...periodParamsT, ...periodParamsG] }
  }
  if (j === 'frame'){
    const sql = `SELECT id_produk, SUM(sum_qty) AS sum_qty, SUM(sum_uang) AS sum_uang FROM (
      SELECT tf.id_frame AS id_produk, tf.qty AS sum_qty, ((SELECT harga_jual FROM frame WHERE frame.id_frame=tf.id_frame) * tf.qty) AS sum_uang FROM transaksi_frame tf LEFT JOIN transaksi t ON t.kode_transaksi = tf.kode_transaksi${periodWhereT}
      UNION ALL
      SELECT gl.id_produk, gl.jumlah AS sum_qty, gl.jumlah_harga AS sum_uang FROM grosir_log gl${periodWhereG} AND gl.jenis_produk='frame'
    ) u GROUP BY id_produk`
    return { sql, params: [...periodParamsT, ...periodParamsG] }
  }
  if (j === 'lensa'){
    const sql = `SELECT id_produk, SUM(sum_qty) AS sum_qty, SUM(sum_uang) AS sum_uang FROM (
      SELECT tl.id_lensa AS id_produk, tl.qty AS sum_qty, ((SELECT harga_jual FROM lensa WHERE lensa.id_lensa=tl.id_lensa) * tl.qty) AS sum_uang FROM transaksi_lensa tl LEFT JOIN transaksi t ON t.kode_transaksi = tl.kode_transaksi${periodWhereT}
      UNION ALL
      SELECT gl.id_produk, gl.jumlah AS sum_qty, gl.jumlah_harga AS sum_uang FROM grosir_log gl${periodWhereG} AND gl.jenis_produk='lensa'
    ) u GROUP BY id_produk`
    return { sql, params: [...periodParamsT, ...periodParamsG] }
  }
  return { sql: '', params: [] }
}