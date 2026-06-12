import { pool } from '../db.js'
import { esClient } from '../elasticsearch.js'

let isSyncing = false;

export async function runDeltaSync() {
  if (isSyncing) {
    console.log('[ES Delta Sync] Previous sync is still running, skipping this tick.');
    return;
  }
  isSyncing = true;

  try {
    const minutesLookback = 5; // Look back 5 minutes
    
    // 1. Get all customer codes that were modified recently
    const sqlCustomers = `
      SELECT kode_customer FROM customer 
      WHERE tanggal_daftar >= NOW() - INTERVAL ? MINUTE
    `;
    
    // 2. Get all customer codes where transactions were modified
    const sqlTransaksi = `
      SELECT kode_customer FROM transaksi 
      WHERE updated_at >= NOW() - INTERVAL ? MINUTE
    `;

    // 3. Get all customer codes where payments were modified
    const sqlPembayaran = `
      SELECT t.kode_customer 
      FROM transaksi_pembayaran tp
      INNER JOIN transaksi t ON t.kode_transaksi = tp.kode_transaksi
      WHERE tp.updated_at >= NOW() - INTERVAL ? MINUTE
    `;

    const [cRows] = await pool.query(sqlCustomers, [minutesLookback]);
    const [tRows] = await pool.query(sqlTransaksi, [minutesLookback]);
    const [pRows] = await pool.query(sqlPembayaran, [minutesLookback]);

    const affectedCodes = new Set();
    cRows.forEach(r => { if (r.kode_customer) affectedCodes.add(r.kode_customer) });
    tRows.forEach(r => { if (r.kode_customer) affectedCodes.add(r.kode_customer) });
    pRows.forEach(r => { if (r.kode_customer) affectedCodes.add(r.kode_customer) });

    const codesArray = Array.from(affectedCodes);
    if (codesArray.length > 0) {
      console.log(`[ES Delta Sync] Found ${codesArray.length} customers modified. Syncing Customers...`);
      await syncCustomers(codesArray);
    }

    // --- Marketing Delta Sync ---
    const sqlTrxAffected = `
      SELECT id_transaksi FROM transaksi WHERE updated_at >= NOW() - INTERVAL ? MINUTE
    `;
    const sqlPembayaranTrx = `
      SELECT t.id_transaksi 
      FROM transaksi_pembayaran tp
      INNER JOIN transaksi t ON t.kode_transaksi = tp.kode_transaksi
      WHERE tp.updated_at >= NOW() - INTERVAL ? MINUTE
    `;
    const [trx1] = await pool.query(sqlTrxAffected, [minutesLookback]);
    const [trx2] = await pool.query(sqlPembayaranTrx, [minutesLookback]);
    const affectedTrx = new Set();
    trx1.forEach(r => affectedTrx.add(r.id_transaksi));
    trx2.forEach(r => affectedTrx.add(r.id_transaksi));
    
    const trxArray = Array.from(affectedTrx);
    if (trxArray.length > 0) {
      console.log(`[ES Delta Sync] Found ${trxArray.length} transactions modified. Syncing Marketing Reports...`);
      await syncMarketing(trxArray);
    }

  } catch (err) {
    console.error('[ES Delta Sync] Error running delta sync:', err);
  } finally {
    isSyncing = false;
  }
}

async function syncCustomers(codesArray) {
  // Fetch full data for these customers
  const sqlFetch = `
    SELECT 
      c.id_customer, c.kode_customer, c.nama_customer, c.no_hp, c.no_ktp, c.status_user, c.blacklist_reason, c.alamat_lengkap,
      c.file_ktp, c.file_kk, c.cabang, c.id_marketing, c.tanggal_daftar as created_at,
      cabang_toko.nama_cabang, admin.nama_lengkap AS nama_marketing,
      (c.file_ktp IS NOT NULL AND c.file_ktp <> '' AND c.file_kk IS NOT NULL AND c.file_kk <> '') as dokumen_lengkap
    FROM customer c
    LEFT JOIN cabang_toko ON cabang_toko.id_cabang = c.cabang
    LEFT JOIN admin ON admin.id = c.id_marketing
    WHERE c.kode_customer IN (?)
  `;
  const [customers] = await pool.query(sqlFetch, [codesArray]);

  if (customers.length === 0) return;

  // Fetch stats
  const sqlStats = `
    SELECT 
      tx.kode_customer,
      SUM(CASE WHEN tx.harga_nego > 0 THEN tx.harga_nego ELSE tx.total_harga END) as total_belanja,
      SUM(IFNULL(tp.jml_bayar, 0)) as total_bayar,
      SUM(IFNULL(svu.total_voucher, 0)) as total_voucher,
      MAX(CASE WHEN ((CASE WHEN tx.harga_nego > 0 THEN tx.harga_nego ELSE tx.total_harga END) - IFNULL(tp.jml_bayar,0) - IFNULL(svu.total_voucher,0)) > 0 
              THEN TIMESTAMPDIFF(MONTH, COALESCE(tp.max_bayar, tx.tanggal_order), CURDATE()) ELSE 0 END) as aging_months
    FROM transaksi tx
    LEFT JOIN (
      SELECT kode_transaksi, SUM(jumlah_bayar + IFNULL(bayar_lain,0) + IFNULL(potong_marketing,0)) AS jml_bayar, MAX(tanggal_bayar) as max_bayar
      FROM transaksi_pembayaran GROUP BY kode_transaksi
    ) tp ON tp.kode_transaksi = tx.kode_transaksi
    LEFT JOIN (
      SELECT kode_transaksi, SUM(voucher_use) AS total_voucher
      FROM sponsor_voucher_use GROUP BY kode_transaksi
    ) svu ON svu.kode_transaksi = tx.kode_transaksi
    WHERE tx.kode_customer IN (?)
    GROUP BY tx.kode_customer
  `;
  const [stats] = await pool.query(sqlStats, [codesArray]);
  const statsMap = new Map();
  for (const st of stats) {
    statsMap.set(st.kode_customer, st);
  }

  // Prepare operations
  const operations = customers.flatMap(c => {
    const st = statsMap.get(c.kode_customer) || { total_belanja: 0, total_bayar: 0, total_voucher: 0, aging_months: 0 };
    const totalBelanja = Number(st.total_belanja || 0);
    const totalBayar = Number(st.total_bayar || 0) + Number(st.total_voucher || 0);
    const sisaHutang = totalBelanja - totalBayar;
    
    return [
      { index: { _index: 'optik_customers', _id: c.kode_customer } },
      {
        id_customer: c.id_customer,
        kode_customer: c.kode_customer,
        nama_customer: c.nama_customer,
        no_hp: c.no_hp,
        no_ktp: c.no_ktp,
        status_user: c.status_user,
        blacklist_reason: c.blacklist_reason,
        alamat_lengkap: c.alamat_lengkap,
        file_ktp: c.file_ktp,
        file_kk: c.file_kk,
        cabang: c.cabang,
        nama_cabang: c.nama_cabang,
        id_marketing: c.id_marketing,
        nama_marketing: c.nama_marketing,
        dokumen_lengkap: c.dokumen_lengkap === 1,
        aging_months: st.aging_months || 0,
        total_belanja: totalBelanja,
        total_bayar: totalBayar,
        sisa_hutang: sisaHutang,
        status_pembayaran: sisaHutang <= 0 ? 'lunas' : 'belum_lunas',
        created_at: c.created_at ? c.created_at.replace(' ', 'T') + 'Z' : null
      }
    ]
  });

  const bulkResponse = await esClient.bulk({ refresh: true, body: operations });
  if (!bulkResponse.errors) {
    console.log(`[ES Delta Sync] Successfully synced ${customers.length} updated customers.`);
  }
}

async function syncMarketing(trxArray) {
  // Sync to the ACTIVE pembukuan only (since delta implies current activity)
  const [activeRows] = await pool.query('SELECT id_toko_tutup, tanggal_buka_buku, tanggal_tutup_buku FROM toko_tutup_buku ORDER BY id_toko_tutup DESC LIMIT 1');
  if (activeRows.length === 0) return;
  const pb = activeRows[0];

  const sqlData = `
    SELECT transaksi.id_transaksi, transaksi.kode_transaksi, transaksi.tanggal_order,
          customer.nama_customer, customer.status_user AS status_user, cabang_toko.nama_cabang, admin.nama_lengkap,
          transaksi.id_marketing, transaksi.id_cabang,
          tp.jml_bayar, UPPER(tp.jenis_transaksi) AS jenis_transaksi_bayar,
          IFNULL(svu.total_voucher, 0) AS total_voucher,
          (CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) AS fix_harga,
          ((CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) - IFNULL(tp.jml_bayar,0) - IFNULL(svu.total_voucher,0)) AS sisa_bayar,
          IFNULL(it.sum_ongkir,0) AS ongkir_items,
          COALESCE((CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) - (IFNULL(it.sum_modal,0) + IFNULL(it.sum_ongkir,0)), 0) AS laba_items,
          (CASE WHEN ((CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) - IFNULL(tp.jml_bayar,0) - IFNULL(svu.total_voucher,0)) <= 0 
                THEN COALESCE((CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) - (IFNULL(it.sum_modal,0) + IFNULL(it.sum_ongkir,0)), 0) ELSE 0 END) AS laba_est,
          (CASE WHEN (IFNULL(tp.jml_bayar,0) + IFNULL(svu.total_voucher,0)) > 0 AND (CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) > 0
                THEN ((IFNULL(tp.jml_bayar,0) + IFNULL(svu.total_voucher,0)) / (CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END)) 
                      * COALESCE((CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) - (IFNULL(it.sum_modal,0) + IFNULL(it.sum_ongkir,0)), 0)
                  ELSE 0 END) AS laba_paid
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
    WHERE transaksi.id_transaksi IN (?)
  `;

  const [dataRows] = await pool.query(sqlData, [pb.tanggal_buka_buku, pb.tanggal_tutup_buku, pb.tanggal_buka_buku, pb.tanggal_tutup_buku, trxArray]);
  
  const operations = dataRows.flatMap(r => {
    const docId = `${r.id_transaksi}_${pb.id_toko_tutup}`;
    return [
      { index: { _index: 'optik_marketing_reports', _id: docId } },
      {
        id_pembukuan: pb.id_toko_tutup,
        id_transaksi: r.id_transaksi,
        kode_transaksi: r.kode_transaksi,
        tanggal_order: r.tanggal_order ? (typeof r.tanggal_order === 'string' ? r.tanggal_order : r.tanggal_order.toISOString().split('T')[0]) : null,
        nama_customer: r.nama_customer,
        status_user: r.status_user,
        nama_cabang: r.nama_cabang,
        nama_lengkap: r.nama_lengkap,
        id_marketing: r.id_marketing,
        id_cabang: r.id_cabang,
        jml_bayar: Number(r.jml_bayar || 0),
        jenis_transaksi_bayar: r.jenis_transaksi_bayar,
        total_voucher: Number(r.total_voucher || 0),
        fix_harga: Number(r.fix_harga || 0),
        sisa_bayar: Number(r.sisa_bayar || 0),
        ongkir_items: Number(r.ongkir_items || 0),
        laba_items: Number(r.laba_items || 0),
        laba_est: Number(r.laba_est || 0),
        laba_paid: Number(r.laba_paid || 0)
      }
    ];
  });

  if (operations.length > 0) {
    const bulkResponse = await esClient.bulk({ refresh: false, body: operations });
    if (!bulkResponse.errors) {
      console.log(`[ES Marketing Delta Sync] Successfully synced ${dataRows.length} marketing reports.`);
    }
  }
}
