import { esClient, checkESConnection } from '../src/elasticsearch.js'
import { pool } from '../src/db.js'

async function setupIndex() {
  const indexName = 'optik_toko_reports'
  
  const exists = await esClient.indices.exists({ index: indexName })
  if (exists) {
    console.log(`[ES Toko Sync] Index ${indexName} already exists, deleting it...`)
    await esClient.indices.delete({ index: indexName })
  }

  console.log(`[ES Toko Sync] Creating index ${indexName}...`)
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
          id_pembukuan: { type: 'integer' },
          kode_grosir: { type: 'keyword' },
          tanggal_order: { type: 'date', format: 'yyyy-MM-dd||strict_date_optional_time||epoch_millis' },
          id_cabang: { type: 'keyword' },
          nama_cabang: { type: 'keyword' },
          jml_bayar: { type: 'long' }, // omset toko
          modal_toko: { type: 'long' },
          ongkir_toko: { type: 'long' }
        }
      }
    }
  })
  console.log(`[ES Toko Sync] Index ${indexName} created.`)
}

async function run() {
  try {
    const isConnected = await checkESConnection()
    if (!isConnected) {
      console.error('[ES Toko Sync] Aborting sync, cannot connect to ES.')
      process.exit(1)
    }
    
    await setupIndex()
    
    const [pembukuans] = await pool.query('SELECT id_toko_tutup, tanggal_buka_buku, tanggal_tutup_buku FROM toko_tutup_buku ORDER BY id_toko_tutup ASC')
    console.log(`[ES Toko Sync] Found ${pembukuans.length} pembukuan periods.`)

    let allDocs = []

    for (const pb of pembukuans) {
      // 1. Omset Toko (grosir_pembayaran)
      // Note: Laba Rugi groups by cabang, so we need id_cabang from grosir_pembayaran or grosir.
      // We will group by id_cabang directly to create 1 doc per cabang per pembukuan!
      // Wait, let's create 1 doc per cabang per pembukuan. It's much simpler!
      
      const [omsetToko] = await pool.query(
        `SELECT gp.id_cabang, (SELECT nama_cabang FROM cabang_toko WHERE id_cabang=gp.id_cabang) AS nama_cabang, SUM(IFNULL(gp.jumlah_bayar,0)) AS omset_toko
         FROM grosir_pembayaran gp
         WHERE gp.tanggal_bayar BETWEEN ? AND ?
         GROUP BY gp.id_cabang`, [pb.tanggal_buka_buku, pb.tanggal_tutup_buku]
      )

      const [tokoModalOngkir] = await pool.query(
        `SELECT grosir_log.id_cabang,
                SUM(CASE 
                  WHEN grosir_log.jenis_produk = 'softlens' THEN (SELECT harga_modal FROM softlens WHERE softlens.id_softlens = grosir_log.id_produk) * grosir_log.jumlah
                  WHEN grosir_log.jenis_produk = 'lensa'    THEN (SELECT harga_modal FROM lensa    WHERE lensa.id_lensa = grosir_log.id_produk) * grosir_log.jumlah
                  WHEN grosir_log.jenis_produk = 'frame'    THEN (SELECT harga_modal FROM frame    WHERE frame.id_frame = grosir_log.id_produk) * grosir_log.jumlah
                  WHEN grosir_log.jenis_produk = 'katalog'  THEN (SELECT harga_modal FROM produk   WHERE produk.id_produk = grosir_log.id_produk) * grosir_log.jumlah
                  ELSE 0 END) AS modal_toko,
                SUM(CASE 
                  WHEN grosir_log.jenis_produk = 'softlens' THEN (SELECT harga_ongkir FROM softlens WHERE softlens.id_softlens = grosir_log.id_produk) * grosir_log.jumlah
                  WHEN grosir_log.jenis_produk = 'lensa'    THEN (SELECT harga_ongkir FROM lensa    WHERE lensa.id_lensa = grosir_log.id_produk) * grosir_log.jumlah
                  WHEN grosir_log.jenis_produk = 'frame'    THEN (SELECT harga_ongkir FROM frame    WHERE frame.id_frame = grosir_log.id_produk) * grosir_log.jumlah
                  WHEN grosir_log.jenis_produk = 'katalog'  THEN (SELECT harga_ongkir FROM produk   WHERE produk.id_produk = grosir_log.id_produk) * grosir_log.jumlah
                  ELSE 0 END) AS ongkir_toko
         FROM grosir_log
         WHERE grosir_log.tanggal_log BETWEEN ? AND ?
         GROUP BY grosir_log.id_cabang`, [pb.tanggal_buka_buku, pb.tanggal_tutup_buku]
      )

      const cabangMap = new Map()
      omsetToko.forEach(r => {
        cabangMap.set(String(r.id_cabang), {
          id_cabang: String(r.id_cabang),
          nama_cabang: r.nama_cabang,
          omset_toko: Number(r.omset_toko || 0),
          modal_toko: 0,
          ongkir_toko: 0
        })
      })

      tokoModalOngkir.forEach(r => {
        const id = String(r.id_cabang)
        if (!cabangMap.has(id)) {
          cabangMap.set(id, { id_cabang: id, nama_cabang: '', omset_toko: 0, modal_toko: 0, ongkir_toko: 0 })
        }
        const entry = cabangMap.get(id)
        entry.modal_toko = Number(r.modal_toko || 0)
        entry.ongkir_toko = Number(r.ongkir_toko || 0)
      })

      for (const entry of cabangMap.values()) {
        const docId = `toko_${entry.id_cabang}_${pb.id_toko_tutup}`
        allDocs.push({
          _id: docId,
          id_pembukuan: pb.id_toko_tutup,
          id_cabang: entry.id_cabang,
          nama_cabang: entry.nama_cabang,
          jml_bayar: entry.omset_toko,
          modal_toko: entry.modal_toko,
          ongkir_toko: entry.ongkir_toko
        })
      }
    }
    
    console.log(`[ES Toko Sync] Total ${allDocs.length} toko summary docs to index. Starting bulk index...`);
    
    const chunkSize = 2000;
    for (let i = 0; i < allDocs.length; i += chunkSize) {
      const chunk = allDocs.slice(i, i + chunkSize);
      const operations = chunk.flatMap(doc => [
        { index: { _index: 'optik_toko_reports', _id: doc._id } },
        { ...doc, _id: undefined }
      ]);
      const bulkResponse = await esClient.bulk({ refresh: false, body: operations });
      if (bulkResponse.errors) {
        console.error('[ES Toko Sync] Errors occurred during bulk indexing of a chunk.');
      }
    }
    
    await esClient.indices.refresh({ index: 'optik_toko_reports' })
    console.log('[ES Toko Sync] All done! Toko summaries are in Elasticsearch now.')
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

run()
