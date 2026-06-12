import { esClient } from '../elasticsearch.js'

export async function fetchMasterItemsES({ jenis, page = 1, limit = 20, q, status, order, soldOnly, cabangId, ready }) {
  const j = String(jenis || '').toLowerCase()
  const allowed = new Set(['katalog', 'softlens', 'frame', 'lensa'])
  if (!allowed.has(j)) throw new Error('jenis invalid')
  
  const from = Math.max(0, (Number(page) - 1) * Number(limit))
  
  const mustFilters = [
    { term: { jenis: j } }
  ]
  
  if (q) {
    mustFilters.push({
      bool: {
        should: [
          { wildcard: { nama: `*${String(q).toLowerCase()}*` } },
          { wildcard: { sku: `*${String(q).toLowerCase()}*` } },
          { term: { id: String(q) } }
        ],
        minimum_should_match: 1
      }
    })
  }

  const statusFilter = (status === 0 || status === 1) ? Number(status) : undefined
  if (statusFilter !== undefined) {
    mustFilters.push({ term: { status: statusFilter } })
  }

  if (cabangId) {
    mustFilters.push({
      nested: {
        path: 'stok_cabang',
        query: {
          bool: {
            must: [
              { term: { 'stok_cabang.id_cabang': String(cabangId) } },
              { range: { 'stok_cabang.stok': { gt: 0 } } }
            ]
          }
        }
      }
    })
  }

  if (ready === '1') {
    mustFilters.push({ range: { total_stok: { gt: 0 } } })
  } else if (ready === '0') {
    mustFilters.push({ range: { total_stok: { lte: 0 } } })
  }

  if (soldOnly) {
    mustFilters.push({ range: { total_qty: { gt: 0 } } })
  }

  const sort = []
  if (order === 'qty') {
    sort.push({ total_qty: { order: 'desc' } })
    sort.push({ id: { order: 'desc' } })
  } else if (order === 'uang') {
    sort.push({ total_uang: { order: 'desc' } })
    sort.push({ id: { order: 'desc' } })
  } else {
    sort.push({ id: { order: 'desc' } })
  }

  const res = await esClient.search({
    index: 'optik_products',
    from: from,
    size: limit > 0 ? Number(limit) : 20,
    body: {
      query: {
        bool: {
          must: mustFilters
        }
      },
      sort: sort
    }
  })

  const total = res.hits.total.value
  const data = res.hits.hits.map(h => {
    const src = h._source
    // Format branch_stocks to match previous format: "1:10,2:5"
    const branch_stocks = (src.stok_cabang || []).map(c => `${c.id_cabang}:${c.stok}`).join(',')
    
    return {
      jenis: src.jenis,
      id: Number(src.id),
      nama: src.nama,
      sku: src.sku,
      harga_modal: src.harga_modal,
      harga_jual: src.harga_jual,
      status: src.status,
      total_qty: src.total_qty,
      total_uang: src.total_uang,
      total_stok: src.total_stok,
      branch_stocks: branch_stocks
    }
  })

  return {
    data,
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / (limit || 1))
    }
  }
}
