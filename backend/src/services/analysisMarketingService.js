import { esClient } from '../elasticsearch.js'
import { pool } from '../db.js'

async function getActivePembukuan(id) {
  if (id) {
    const [rows] = await pool.query('SELECT * FROM toko_tutup_buku WHERE id_toko_tutup = ?', [id])
    return rows[0]
  }
  const [rows] = await pool.query('SELECT * FROM toko_tutup_buku ORDER BY id_toko_tutup DESC LIMIT 1')
  return rows[0]
}

function diffMonths(d1, d2) {
  let months;
  months = (d2.getFullYear() - d1.getFullYear()) * 12;
  months -= d1.getMonth();
  months += d2.getMonth();
  return months <= 0 ? 0 : months;
}

export async function getAnalysisMarketingES({ marketingId, pembukuanId }) {
  const active = pembukuanId ? await getActivePembukuan(pembukuanId) : null

  const mustFilters = [
    { term: { id_marketing: String(marketingId) } }
  ]

  if (active) {
    const bukaBukuStr = active.tanggal_buka_buku instanceof Date ? active.tanggal_buka_buku.toISOString().split('T')[0] : String(active.tanggal_buka_buku).substring(0, 10)
    const tutupBukuStr = active.tanggal_tutup_buku instanceof Date ? active.tanggal_tutup_buku.toISOString().split('T')[0] : String(active.tanggal_tutup_buku).substring(0, 10)
    mustFilters.push({
      range: { tanggal_order: { gte: bukaBukuStr, lte: tutupBukuStr } }
    })
  }

  const res = await esClient.search({
    index: 'optik_marketing_reports',
    size: 50000,
    body: {
      query: {
        bool: {
          must: mustFilters
        }
      }
    }
  })

  const rawDocs = res.hits.hits.map(h => h._source)
  
  // Compute summary (Overdue)
  let t1 = 0, t3 = 0, t6 = 0, t12 = 0, tgt12 = 0, total_macet = 0, total_blacklist = 0, num_blacklist = new Set();
  const now = new Date();
  
  for (const doc of rawDocs) {
    const isBlacklist = String(doc.status_user || '').toLowerCase() === 'blacklist';
    if (doc.sisa_bayar > 0) {
      if (isBlacklist) {
        total_blacklist += doc.sisa_bayar;
        if (doc.kode_customer) num_blacklist.add(doc.kode_customer);
      } else {
        total_macet += doc.sisa_bayar;
        const lastDate = doc.last_bayar ? new Date(doc.last_bayar) : new Date(doc.tanggal_order);
        const months = diffMonths(lastDate, now);
        if (months <= 1) t1 += doc.sisa_bayar;
        else if (months <= 3) t3 += doc.sisa_bayar;
        else if (months <= 6) t6 += doc.sisa_bayar;
        else if (months <= 12) t12 += doc.sisa_bayar;
        else tgt12 += doc.sisa_bayar;
      }
    }
  }

  const summary = {
    data: [{
      tagihan_1_bulan: t1,
      tagihan_3_bulan: t3,
      tagihan_6_bulan: t6,
      tagihan_1_tahun: t12,
      tagihan_gt_1_tahun: tgt12,
      total_macet,
      total_blacklist,
      num_blacklist_customer: num_blacklist.size
    }]
  }

  // Transactions (for walking list)
  const transactions = rawDocs.map(d => ({
    id_transaksi: d.id_transaksi,
    kode_transaksi: d.kode_transaksi,
    tanggal_order: d.tanggal_order,
    nama_customer: d.nama_customer,
    status_user: d.status_user,
    fix_harga: d.fix_harga,
    jml_bayar: d.jml_bayar,
    sisa_bayar: d.sisa_bayar,
    last_bayar: d.last_bayar,
    last_jenis_transaksi: d.last_jenis_transaksi
  })).filter(d => d.sisa_bayar > 0) // Overdue transactions

  // Distribution
  let qty_kacamata = 0, qty_ganti_lensa = 0, qty_frame = 0, qty_lensa = 0, qty_softlens = 0;
  for (const doc of rawDocs) {
    if (!doc.items) continue;
    for (const item of doc.items) {
      if (item.jenis_sub_trx === 'kacamata') qty_kacamata += item.jumlah;
      else if (item.jenis_sub_trx === 'ganti_lensa') qty_ganti_lensa += item.jumlah;
      else if (item.jenis_produk === 'frame' && (!item.jenis_sub_trx || item.jenis_sub_trx === 'frame')) qty_frame += item.jumlah;
      else if (item.jenis_produk === 'lensa' && !item.jenis_sub_trx) qty_lensa += item.jumlah;
      else if (item.jenis_produk === 'softlens') qty_softlens += item.jumlah;
    }
  }
  const distribution = { qty_kacamata, qty_ganti_lensa, qty_frame, qty_lensa, qty_softlens }

  // Completeness
  let miss_hp = 0, miss_alamat = 0, miss_ktp = 0, miss_kk = 0;
  for (const doc of rawDocs) {
    if (!doc.no_hp) miss_hp++;
    if (!doc.alamat_lengkap) miss_alamat++;
    if (!doc.file_ktp) miss_ktp++;
    if (!doc.file_kk) miss_kk++;
  }
  const totalDocs = rawDocs.length || 1;
  const completeDocs = rawDocs.filter(d => d.dokumen_lengkap).length;
  const completeness = {
    percent: (completeDocs / totalDocs) * 100,
    missing: {
      no_hp: miss_hp,
      alamat_lengkap: miss_alamat,
      file_ktp_url: miss_ktp,
      file_kk_url: miss_kk
    }
  }

  // Items
  const items = [];
  for (const doc of rawDocs) {
    if (!doc.items) continue;
    for (const item of doc.items) {
      items.push({
        kode_transaksi: doc.kode_transaksi,
        nama_customer: doc.nama_customer,
        nama_lengkap: doc.nama_lengkap,
        jenis_produk: item.jenis_produk,
        jenis_sub_trx: item.jenis_sub_trx,
        jumlah: item.jumlah,
        id_produk: item.id_produk,
        jumlah_harga: item.jumlah_harga,
        laba_item: item.laba_item,
        tanggal_log: item.tanggal_log || doc.tanggal_order,
        nama_produk: item.nama_produk || `${item.jenis_produk} #${item.id_produk}`
      })
    }
  }

  // Monthly
  const monthlyMap = new Map();
  for (const doc of rawDocs) {
    if (!doc.tanggal_order) continue;
    const m = doc.tanggal_order.substring(0, 7); // YYYY-MM
    const cur = monthlyMap.get(m) || { bulan: m, total_transaksi: 0, total_fix: 0 };
    cur.total_transaksi++;
    cur.total_fix += doc.fix_harga;
    monthlyMap.set(m, cur);
  }
  const monthly = Array.from(monthlyMap.values()).sort((a,b) => a.bulan.localeCompare(b.bulan))

  // All Transactions (for Laba calculation)
  const allTransactions = rawDocs.map(d => ({
    kode_transaksi: d.kode_transaksi,
    sisa_bayar: d.sisa_bayar
  }))

  return {
    summary,
    transactions: { data: transactions },
    distribution,
    completeness,
    items,
    monthly,
    allTransactions
  }
}
