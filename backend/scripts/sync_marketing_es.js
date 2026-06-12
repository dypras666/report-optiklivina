import dotenv from 'dotenv'
dotenv.config({ path: '../.env' })
dotenv.config()

import { esClient, checkESConnection } from '../src/elasticsearch.js'
import { pool } from '../src/db.js'

async function setupIndex() {
  const indexName = 'optik_marketing_reports'
  
  const exists = await esClient.indices.exists({ index: indexName })
  if (exists) {
    console.log(`[ES Marketing Sync] Index ${indexName} already exists, deleting it to recreate mapping...`)
    await esClient.indices.delete({ index: indexName })
  }

  console.log(`[ES Marketing Sync] Creating index ${indexName}...`)
  await esClient.indices.create({
    index: indexName,
    body: {
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0,
        max_result_window: 100000
      },
      mappings: {
        properties: {
          id_pembukuan: { type: 'keyword' },
          id_transaksi: { type: 'keyword' },
          kode_transaksi: { type: 'keyword' },
          tanggal_order: { type: 'date' },
          nama_customer: { type: 'text', fields: { keyword: { type: 'keyword', ignore_above: 256 } } },
          status_user: { type: 'keyword' },
          no_hp: { type: 'keyword' },
          alamat_lengkap: { type: 'text' },
          file_ktp: { type: 'keyword' },
          file_kk: { type: 'keyword' },
          dokumen_lengkap: { type: 'boolean' },
          nama_cabang: { type: 'keyword' },
          nama_lengkap: { type: 'keyword' }, // marketing
          id_marketing: { type: 'keyword' },
          id_cabang: { type: 'keyword' },
          jml_bayar: { type: 'long' },
          jenis_transaksi_bayar: { type: 'keyword' },
          last_bayar: { type: 'date' },
          last_jenis_transaksi: { type: 'keyword' },
          total_voucher: { type: 'long' },
          fix_harga: { type: 'long' },
          sisa_bayar: { type: 'long' },
          ongkir_items: { type: 'long' },
          laba_items: { type: 'long' },
          laba_est: { type: 'long' },
          laba_paid: { type: 'long' },
          items: {
            type: 'nested',
            properties: {
              id_produk: { type: 'keyword' },
              jenis_produk: { type: 'keyword' },
              jenis_sub_trx: { type: 'keyword' },
              nama_produk: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              jumlah: { type: 'integer' },
              jumlah_harga: { type: 'long' },
              laba_item: { type: 'long' },
              tanggal_log: { type: 'date' }
            }
          }
        }
      }
    }
  })
  console.log(`[ES Marketing Sync] Index ${indexName} created.`)
}

async function syncAllMarketingData() {
  const [pembukuans] = await pool.query('SELECT id_toko_tutup, tanggal_buka_buku, tanggal_tutup_buku FROM toko_tutup_buku ORDER BY id_toko_tutup ASC');
  
  console.log(`[ES Marketing Sync] Found ${pembukuans.length} pembukuan periods to process.`);

  let totalSynced = 0;

  for (const pb of pembukuans) {
    console.log(`[ES Marketing Sync] Processing Pembukuan ${pb.id_toko_tutup} (${pb.tanggal_buka_buku} to ${pb.tanggal_tutup_buku})...`);
    
    const sqlTransaksi = `
      SELECT DISTINCT t.id_transaksi
      FROM transaksi t
      LEFT JOIN transaksi_pembayaran tp ON tp.kode_transaksi = t.kode_transaksi
      WHERE (t.tanggal_order BETWEEN ? AND ?) OR (tp.tanggal_bayar BETWEEN ? AND ?)
    `;
    const [trxRows] = await pool.query(sqlTransaksi, [pb.tanggal_buka_buku, pb.tanggal_tutup_buku, pb.tanggal_buka_buku, pb.tanggal_tutup_buku]);
    
    if (trxRows.length === 0) continue;

    const trxIds = trxRows.map(r => r.id_transaksi);
    
    const chunkSize = 2000;
    for (let i = 0; i < trxIds.length; i += chunkSize) {
      const chunkIds = trxIds.slice(i, i + chunkSize);
      
      // Query 1: Get base transaction data + customer info
      const sqlData = `
        SELECT transaksi.id_transaksi, transaksi.kode_transaksi, transaksi.tanggal_order,
              customer.nama_customer, customer.status_user AS status_user, 
              customer.no_hp, customer.alamat_lengkap, customer.file_ktp, customer.file_kk,
              (customer.file_ktp IS NOT NULL AND customer.file_ktp <> '' AND customer.file_kk IS NOT NULL AND customer.file_kk <> '') as dokumen_lengkap,
              cabang_toko.nama_cabang, admin.nama_lengkap,
              transaksi.id_marketing, transaksi.id_cabang,
              tp.jml_bayar, UPPER(tp.jenis_transaksi_bayar) AS jenis_transaksi_bayar,
              tp.last_bayar, UPPER(tp.last_jenis_transaksi) AS last_jenis_transaksi,
              IFNULL(svu.total_voucher, 0) AS total_voucher,
              (CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) AS fix_harga,
              ((CASE WHEN (transaksi.harga_nego > 0) THEN transaksi.harga_nego ELSE transaksi.total_harga END) - IFNULL(tp.jml_bayar,0) - IFNULL(svu.total_voucher,0)) AS sisa_bayar
        FROM transaksi
        LEFT JOIN (
          SELECT kode_transaksi, SUM(jumlah_bayar + IFNULL(bayar_lain, 0) + IFNULL(potong_marketing, 0)) AS jml_bayar,
                MAX(jenis_transaksi) AS jenis_transaksi_bayar,
                MAX(tanggal_bayar) AS last_bayar,
                (SELECT tpx.jenis_transaksi FROM transaksi_pembayaran tpx WHERE tpx.kode_transaksi = transaksi_pembayaran.kode_transaksi ORDER BY tpx.tanggal_bayar DESC, tpx.id_pembayaran DESC LIMIT 1) AS last_jenis_transaksi
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
        LEFT JOIN customer ON customer.kode_customer = transaksi.kode_customer
        LEFT JOIN cabang_toko ON cabang_toko.id_cabang = transaksi.id_cabang
        LEFT JOIN admin ON admin.id = transaksi.id_marketing
        WHERE transaksi.id_transaksi IN (?)
      `;
      const [dataRows] = await pool.query(sqlData, [pb.tanggal_buka_buku, pb.tanggal_tutup_buku, chunkIds]);
      
      const kodes = dataRows.map(r => r.kode_transaksi).filter(Boolean);
      const kodesAndIds = [...kodes, ...chunkIds];

      // Query 2: Get Items mapping for these transactions
      let itemsByTrx = new Map();
      if (kodesAndIds.length > 0) {
        const sqlItems = `
          SELECT tl.id_grosir, tl.id_produk, tl.jenis_produk, tl.jenis_sub_trx, tl.jumlah, tl.jumlah_harga, tl.tanggal_log,
            (CASE tl.jenis_produk
              WHEN 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = tl.id_produk)
              WHEN 'lensa'    THEN (SELECT harga_modal FROM lensa    WHERE lensa.id_lensa = tl.id_produk)
              WHEN 'frame'    THEN (SELECT harga_modal FROM frame    WHERE frame.id_frame = tl.id_produk)
              WHEN 'katalog'  THEN (SELECT harga_modal FROM produk   WHERE produk.id_produk = tl.id_produk)
              ELSE 0 END) AS harga_modal,
            (CASE tl.jenis_produk
              WHEN 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = tl.id_produk)
              WHEN 'lensa'    THEN (SELECT harga_ongkir FROM lensa    WHERE lensa.id_lensa = tl.id_produk)
              WHEN 'frame'    THEN (SELECT harga_ongkir FROM frame    WHERE frame.id_frame = tl.id_produk)
              WHEN 'katalog'  THEN (SELECT harga_ongkir FROM produk   WHERE produk.id_produk = tl.id_produk)
              ELSE 0 END) AS harga_ongkir,
            (CASE tl.jenis_produk
              WHEN 'softlens' THEN (SELECT nama_softlens FROM softlens WHERE softlens.id_softlens = tl.id_produk)
              WHEN 'lensa'    THEN (SELECT sku_lensa FROM lensa WHERE lensa.id_lensa = tl.id_produk)
              WHEN 'frame'    THEN (SELECT sku_frame FROM frame WHERE frame.id_frame = tl.id_produk)
              WHEN 'katalog'  THEN (SELECT nama_produk FROM produk   WHERE produk.id_produk = tl.id_produk)
              ELSE '' END) AS nama_produk
          FROM transaksi_log tl
          WHERE tl.id_grosir IN (?)
            AND tl.tanggal_log BETWEEN ? AND ?
        `;
        const [itemRows] = await pool.query(sqlItems, [kodesAndIds, pb.tanggal_buka_buku, pb.tanggal_tutup_buku]);
        
        for (const it of itemRows) {
          const key = String(it.kode_transaksi || it.id_grosir);
          const hm = Number(it.harga_modal || 0);
          const ho = Number(it.harga_ongkir || 0);
          const jh = Number(it.jumlah_harga || 0);
          const qty = Number(it.jumlah || 0);
          const laba_item = Math.max(0, jh - ((hm * qty) + (ho * qty)));
          
          const parsedItem = {
            id_produk: String(it.id_produk || ''),
            jenis_produk: it.jenis_produk,
            jenis_sub_trx: it.jenis_sub_trx,
            nama_produk: it.nama_produk,
            jumlah: qty,
            jumlah_harga: jh,
            laba_item: laba_item,
            ongkir: ho * qty,
            modal: hm * qty,
            tanggal_log: it.tanggal_log ? (typeof it.tanggal_log === 'string' ? it.tanggal_log : it.tanggal_log.toISOString().split('T')[0]) : null
          };

          const arr = itemsByTrx.get(key) || [];
          arr.push(parsedItem);
          itemsByTrx.set(key, arr);
        }
      }

      const operations = dataRows.flatMap(r => {
        const docId = `${r.id_transaksi}_${pb.id_toko_tutup}`;
        const trxItems = itemsByTrx.get(String(r.kode_transaksi)) || itemsByTrx.get(String(r.id_transaksi)) || [];
        
        let sum_ongkir = 0;
        let sum_laba_items = 0;
        let sum_modal = 0;
        
        trxItems.forEach(it => {
          sum_ongkir += it.ongkir;
          sum_modal += it.modal;
        });

        // Calculate transaction level laba based on the fixed formula
        const fixHarga = Number(r.fix_harga || 0);
        const sisaBayar = Number(r.sisa_bayar || 0);
        sum_laba_items = Math.max(0, fixHarga - (sum_modal + sum_ongkir));

        let laba_est = 0;
        if (sisaBayar <= 0) laba_est = sum_laba_items;

        let laba_paid = 0;
        const totalPaid = fixHarga - sisaBayar;
        if (totalPaid > 0 && fixHarga > 0) {
          laba_paid = (totalPaid / fixHarga) * sum_laba_items;
        }

        const cleanItems = trxItems.map(it => {
          const { ongkir, modal, ...rest } = it;
          return rest;
        });

        return [
          { index: { _index: 'optik_marketing_reports', _id: docId } },
          {
            id_pembukuan: pb.id_toko_tutup,
            id_transaksi: r.id_transaksi,
            kode_transaksi: r.kode_transaksi,
            tanggal_order: r.tanggal_order ? (typeof r.tanggal_order === 'string' ? r.tanggal_order : r.tanggal_order.toISOString().split('T')[0]) : null,
            nama_customer: r.nama_customer,
            status_user: r.status_user,
            no_hp: r.no_hp,
            alamat_lengkap: r.alamat_lengkap,
            file_ktp: r.file_ktp,
            file_kk: r.file_kk,
            dokumen_lengkap: r.dokumen_lengkap === 1,
            nama_cabang: r.nama_cabang,
            nama_lengkap: r.nama_lengkap,
            id_marketing: r.id_marketing,
            id_cabang: r.id_cabang,
            jml_bayar: Number(r.jml_bayar || 0),
            jenis_transaksi_bayar: r.jenis_transaksi_bayar,
            last_bayar: r.last_bayar ? (typeof r.last_bayar === 'string' ? r.last_bayar : r.last_bayar.toISOString().split('T')[0]) : null,
            last_jenis_transaksi: r.last_jenis_transaksi,
            total_voucher: Number(r.total_voucher || 0),
            fix_harga: fixHarga,
            sisa_bayar: sisaBayar,
            ongkir_items: sum_ongkir,
            laba_items: sum_laba_items,
            laba_est: laba_est,
            laba_paid: laba_paid,
            items: cleanItems
          }
        ];
      });

      if (operations.length > 0) {
        const bulkResponse = await esClient.bulk({ refresh: false, body: operations });
        if (bulkResponse.errors) {
          console.error(`[ES Marketing Sync] Errors in bulk insert for Pembukuan ${pb.id_toko_tutup}`);
        } else {
          totalSynced += dataRows.length;
        }
      }
    }
  }

  await esClient.indices.refresh({ index: 'optik_marketing_reports' })
  console.log(`[ES Marketing Sync] All done! Successfully synced ${totalSynced} marketing report items total.`)
}

async function run() {
  try {
    const isConnected = await checkESConnection()
    if (!isConnected) {
      console.error('[ES Marketing Sync] Aborting sync, cannot connect to ES.')
      process.exit(1)
    }
    
    await setupIndex()
    await syncAllMarketingData()
    
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

run()
