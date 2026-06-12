import fs from 'fs'

const file = './src/services/reportsService.js'
let content = fs.readFileSync(file, 'utf8')

const fetchMarketingReportsES = `
import { esClient } from '../elasticsearch.js'

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
          { wildcard: { kode_transaksi: \`*\${q}*\` } },
          { wildcard: { nama_customer: \`*\${q}*\` } },
          { wildcard: { nama_lengkap: \`*\${q}*\` } }
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
`

const fetchMarketingReportsByPaymentPeriodES = `
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
          { wildcard: { kode_transaksi: \`*\${q}*\` } },
          { wildcard: { nama_customer: \`*\${q}*\` } },
          { wildcard: { nama_lengkap: \`*\${q}*\` } }
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
`

// Replace fetchMarketingReports
content = content.replace(/export async function fetchMarketingReports\(\{[\s\S]*?return \{ data: rows, total, sums \}\n\}/, fetchMarketingReportsES.trim())

// Replace fetchMarketingReportsByPaymentPeriod
content = content.replace(/export async function fetchMarketingReportsByPaymentPeriod\(\{[\s\S]*?return \{ data: rows, total, sums \}\n\}/, fetchMarketingReportsByPaymentPeriodES.trim())

// Make sure import { esClient } exists
if (!content.includes("import { esClient }")) {
  content = content.replace("import { pool } from '../db.js'", "import { pool } from '../db.js'\nimport { esClient } from '../elasticsearch.js'")
} else {
  // Remove duplicate import we might have added
  content = content.replace(/import \{ esClient \} from '\.\.\/elasticsearch\.js'\n\nexport async function fetchMarketingReports/, "export async function fetchMarketingReports")
}

fs.writeFileSync(file, content)
console.log('Marketing endpoints patched to use Elasticsearch!')
