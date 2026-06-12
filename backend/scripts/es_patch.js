import fs from 'fs';

const file = 'src/services/reportsService.js';
let content = fs.readFileSync(file, 'utf8');

const newImplementation = `
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
        file_ktp_url: r.file_ktp ? \`https://ap2.optiklivina.com/uploads/customer_ktp/\${r.file_ktp}\` : null,
        file_kk_url: r.file_kk ? \`https://ap2.optiklivina.com/uploads/customer_kk/\${r.file_kk}\` : null
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
`;

const regex = /export async function fetchCustomers\(\{[\s\S]*?(?=export async function fetchCustomerSummaryByCode)/;
if (regex.test(content)) {
  content = content.replace(regex, newImplementation + '\\n\\n');
  fs.writeFileSync(file, content);
  console.log('Successfully patched reportsService.js with Elasticsearch implementations');
} else {
  console.log('Failed to find target block in reportsService.js');
}
