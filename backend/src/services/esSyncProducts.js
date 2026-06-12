import { esClient, checkESConnection } from '../elasticsearch.js'
import { pool } from '../db.js'

async function setupIndex() {
  const indexName = 'optik_products'
  
  const exists = await esClient.indices.exists({ index: indexName })
  if (exists) {
    console.log(`[ES Products Sync] Index ${indexName} already exists, deleting it...`)
    await esClient.indices.delete({ index: indexName })
  }

  console.log(`[ES Products Sync] Creating index ${indexName}...`)
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
          id: { type: 'keyword' },
          jenis: { type: 'keyword' }, // katalog, softlens, frame, lensa
          nama: { type: 'text', fields: { keyword: { type: 'keyword', ignore_above: 256 } } },
          sku: { type: 'keyword' },
          harga_modal: { type: 'long' },
          harga_jual: { type: 'long' },
          status: { type: 'integer' }, // 1 or 0
          total_qty: { type: 'long' },
          total_uang: { type: 'long' },
          total_stok: { type: 'long' },
          stok_cabang: {
            type: 'nested',
            properties: {
              id_cabang: { type: 'keyword' },
              stok: { type: 'long' }
            }
          }
        }
      }
    }
  })
  console.log(`[ES Products Sync] Index ${indexName} created.`)
}

async function fetchStatusMap(jenis) {
  const [rows] = await pool.query("SELECT product_id, status FROM asset_status WHERE jenis=?", [jenis]);
  const map = new Map();
  for (const r of rows) map.set(String(r.product_id), r.status);
  return map;
}

async function syncKatalog() {
  console.log('[ES Products Sync] Syncing Katalog (produk)...');
  const [rows] = await pool.query('SELECT id_produk, nama_produk, sku_katalog, harga_modal, harga_jual FROM produk');
  
  const [stokRows] = await pool.query('SELECT id_produk, id_cabang, SUM(stok) as sum_stok FROM produk_stok_cabang GROUP BY id_produk, id_cabang');
  const stokMap = new Map();
  for (const r of stokRows) {
    const id = String(r.id_produk);
    if (!stokMap.has(id)) stokMap.set(id, []);
    stokMap.get(id).push({ id_cabang: String(r.id_cabang), stok: Number(r.sum_stok || 0) });
  }

  const [aggRows] = await pool.query(`
    SELECT tb.id_produk, SUM(tb.qty) AS sum_qty, SUM(p.harga_jual * tb.qty) AS sum_uang 
    FROM transaksi_barang tb 
    INNER JOIN produk p ON p.id_produk = tb.id_produk
    GROUP BY tb.id_produk
  `);
  const aggMap = new Map();
  for (const r of aggRows) aggMap.set(String(r.id_produk), { qty: Number(r.sum_qty || 0), uang: Number(r.sum_uang || 0) });

  const statusMap = await fetchStatusMap('katalog');

  return rows.map(r => {
    const id = String(r.id_produk);
    const stokCabang = stokMap.get(id) || [];
    const totalStok = stokCabang.reduce((acc, curr) => acc + curr.stok, 0);
    const agg = aggMap.get(id) || { qty: 0, uang: 0 };
    const status = statusMap.has(id) ? statusMap.get(id) : 1;

    return {
      _id: `katalog_${id}`,
      id: id,
      jenis: 'katalog',
      nama: r.nama_produk || '',
      sku: r.sku_katalog || '',
      harga_modal: Number(r.harga_modal || 0),
      harga_jual: Number(r.harga_jual || 0),
      status: status,
      total_qty: agg.qty,
      total_uang: agg.uang,
      total_stok: totalStok,
      stok_cabang: stokCabang
    };
  });
}

async function syncSoftlens() {
  console.log('[ES Products Sync] Syncing Softlens...');
  const [rows] = await pool.query('SELECT id_softlens, nama_softlens, sku_softlens, harga_modal, harga_jual FROM softlens');
  
  const [stokRows] = await pool.query('SELECT id_softlens, id_cabang, SUM(stok) as sum_stok FROM softlens_stok_cabang GROUP BY id_softlens, id_cabang');
  const stokMap = new Map();
  for (const r of stokRows) {
    const id = String(r.id_softlens);
    if (!stokMap.has(id)) stokMap.set(id, []);
    stokMap.get(id).push({ id_cabang: String(r.id_cabang), stok: Number(r.sum_stok || 0) });
  }

  const [aggRows] = await pool.query(`
    SELECT id_produk, SUM(jumlah) AS sum_qty, SUM(jumlah_harga) AS sum_uang
    FROM transaksi_log WHERE jenis_produk='softlens'
    GROUP BY id_produk
  `);
  const aggMap = new Map();
  for (const r of aggRows) aggMap.set(String(r.id_produk), { qty: Number(r.sum_qty || 0), uang: Number(r.sum_uang || 0) });

  const statusMap = await fetchStatusMap('softlens');

  return rows.map(r => {
    const id = String(r.id_softlens);
    const stokCabang = stokMap.get(id) || [];
    const totalStok = stokCabang.reduce((acc, curr) => acc + curr.stok, 0);
    const agg = aggMap.get(id) || { qty: 0, uang: 0 };
    const status = statusMap.has(id) ? statusMap.get(id) : 1;

    return {
      _id: `softlens_${id}`,
      id: id,
      jenis: 'softlens',
      nama: r.nama_softlens || '',
      sku: r.sku_softlens || '',
      harga_modal: Number(r.harga_modal || 0),
      harga_jual: Number(r.harga_jual || 0),
      status: status,
      total_qty: agg.qty,
      total_uang: agg.uang,
      total_stok: totalStok,
      stok_cabang: stokCabang
    };
  });
}

async function syncFrame() {
  console.log('[ES Products Sync] Syncing Frame...');
  const [rows] = await pool.query(`
    SELECT f.id_frame, fk.nama_frame, f.sku_frame, f.harga_modal, f.harga_jual 
    FROM frame f 
    LEFT JOIN frame_kat fk ON fk.id_kat_frame = f.id_kat_frame
  `);
  
  const [stokRows] = await pool.query('SELECT id_frame, id_cabang, SUM(stok_cb) as sum_stok FROM frame_stok_cabang GROUP BY id_frame, id_cabang');
  const stokMap = new Map();
  for (const r of stokRows) {
    const id = String(r.id_frame);
    if (!stokMap.has(id)) stokMap.set(id, []);
    stokMap.get(id).push({ id_cabang: String(r.id_cabang), stok: Number(r.sum_stok || 0) });
  }

  const [aggRows] = await pool.query(`
    SELECT id_produk, SUM(jumlah) AS sum_qty, SUM(jumlah_harga) AS sum_uang
    FROM transaksi_log WHERE jenis_produk='frame'
    GROUP BY id_produk
  `);
  const aggMap = new Map();
  for (const r of aggRows) aggMap.set(String(r.id_produk), { qty: Number(r.sum_qty || 0), uang: Number(r.sum_uang || 0) });

  const statusMap = await fetchStatusMap('frame');

  return rows.map(r => {
    const id = String(r.id_frame);
    const stokCabang = stokMap.get(id) || [];
    const totalStok = stokCabang.reduce((acc, curr) => acc + curr.stok, 0);
    const agg = aggMap.get(id) || { qty: 0, uang: 0 };
    const status = statusMap.has(id) ? statusMap.get(id) : 1;

    return {
      _id: `frame_${id}`,
      id: id,
      jenis: 'frame',
      nama: r.nama_frame || '',
      sku: r.sku_frame || '',
      harga_modal: Number(r.harga_modal || 0),
      harga_jual: Number(r.harga_jual || 0),
      status: status,
      total_qty: agg.qty,
      total_uang: agg.uang,
      total_stok: totalStok,
      stok_cabang: stokCabang
    };
  });
}

async function syncLensa() {
  console.log('[ES Products Sync] Syncing Lensa...');
  const [rows] = await pool.query(`
    SELECT l.id_lensa, lk.nama_lensa_kat, l.size, l.sku_lensa, l.harga_modal, l.harga_jual 
    FROM lensa l
    LEFT JOIN lensa_kat lk ON lk.id_lensa_kat = l.id_lensa_kat
  `);
  
  const [stokRows] = await pool.query('SELECT id_lensa, id_cabang, SUM(stok_masuk) as sum_stok FROM lensa_stok_cabang GROUP BY id_lensa, id_cabang');
  const stokMap = new Map();
  for (const r of stokRows) {
    const id = String(r.id_lensa);
    if (!stokMap.has(id)) stokMap.set(id, []);
    stokMap.get(id).push({ id_cabang: String(r.id_cabang), stok: Number(r.sum_stok || 0) });
  }

  const [aggRows] = await pool.query(`
    SELECT id_produk, SUM(jumlah) AS sum_qty, SUM(jumlah_harga) AS sum_uang
    FROM transaksi_log WHERE jenis_produk='lensa'
    GROUP BY id_produk
  `);
  const aggMap = new Map();
  for (const r of aggRows) aggMap.set(String(r.id_produk), { qty: Number(r.sum_qty || 0), uang: Number(r.sum_uang || 0) });

  const statusMap = await fetchStatusMap('lensa');

  return rows.map(r => {
    const id = String(r.id_lensa);
    const stokCabang = stokMap.get(id) || [];
    const totalStok = stokCabang.reduce((acc, curr) => acc + curr.stok, 0);
    const agg = aggMap.get(id) || { qty: 0, uang: 0 };
    const status = statusMap.has(id) ? statusMap.get(id) : 1;

    return {
      _id: `lensa_${id}`,
      id: id,
      jenis: 'lensa',
      nama: (r.nama_lensa_kat ? `${r.nama_lensa_kat} ${r.size || ''}`.trim() : ''),
      sku: r.sku_lensa || '',
      harga_modal: Number(r.harga_modal || 0),
      harga_jual: Number(r.harga_jual || 0),
      status: status,
      total_qty: agg.qty,
      total_uang: agg.uang,
      total_stok: totalStok,
      stok_cabang: stokCabang
    };
  });
}

let isSyncingProducts = false

export async function runProductsSync() {
  if (isSyncingProducts) {
    console.log('[ES Products Sync] Previous sync is still running, skipping this tick.');
    return;
  }
  isSyncingProducts = true;

  try {
    const isConnected = await checkESConnection()
    if (!isConnected) {
      console.error('[ES Products Sync] Aborting sync, cannot connect to ES.')
      return;
    }
    
    await setupIndex()
    
    let allDocs = [];
    
    const katalogDocs = await syncKatalog();
    allDocs = allDocs.concat(katalogDocs);
    
    const softlensDocs = await syncSoftlens();
    allDocs = allDocs.concat(softlensDocs);
    
    const frameDocs = await syncFrame();
    allDocs = allDocs.concat(frameDocs);
    
    const lensaDocs = await syncLensa();
    allDocs = allDocs.concat(lensaDocs);
    
    console.log(`[ES Products Sync] Total ${allDocs.length} products to index. Starting bulk index...`);
    
    const chunkSize = 2000;
    for (let i = 0; i < allDocs.length; i += chunkSize) {
      const chunk = allDocs.slice(i, i + chunkSize);
      const operations = chunk.flatMap(doc => [
        { index: { _index: 'optik_products', _id: doc._id } },
        { ...doc, _id: undefined }
      ]);
      const bulkResponse = await esClient.bulk({ refresh: false, body: operations });
      if (bulkResponse.errors) {
        console.error('[ES Products Sync] Errors occurred during bulk indexing of a chunk.');
      }
    }
    
    await esClient.indices.refresh({ index: 'optik_products' })
    console.log('[ES Products Sync] All done! Products are searchable via Elasticsearch now.')
  } catch (err) {
    console.error('[ES Products Sync] Error during sync:', err)
  } finally {
    isSyncingProducts = false;
  }
}
