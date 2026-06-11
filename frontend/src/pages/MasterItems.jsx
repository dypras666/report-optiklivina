import React from 'react'
import ProductTransactionDetailTrigger from '@/components/aset/ProductTransactionDetailTrigger.jsx'
import Pagination from '@/components/ui/Pagination.jsx'
import { TableBodySkeleton } from '@/components/ui/TableSkeleton.jsx'
import { tableClass, theadClass, containerClass } from '@/components/ui/tableStyles.js'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://reportsapi.optiklivina.com'

function fmtCurrency(n){ return Number(n||0).toLocaleString('id-ID') }

export default function MasterItems({ jenis }){
  const [rows, setRows] = React.useState([])
  const [loading, setLoading] = React.useState(false)
  const [meta, setMeta] = React.useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [q, setQ] = React.useState('')
  const [st, setSt] = React.useState('')
  const [ord, setOrd] = React.useState('')
  const [soldOnly, setSoldOnly] = React.useState(false)
  const [cabang, setCabang] = React.useState('')
  const [cabangOpts, setCabangOpts] = React.useState([])
  const [ready, setReady] = React.useState('')

  const title = React.useMemo(() => {
    const t = String(jenis||'').toLowerCase()
    if(t==='katalog') return 'Master Katalog'
    if(t==='frame') return 'Master Frame'
    if(t==='softlens') return 'Master Softlens'
    if(t==='lensa') return 'Master Lensa'
    return 'Master'
  }, [jenis])

  React.useEffect(() => {
    fetch(`${API_BASE}/api/options/cabang`).then(r=>r.json()).then(j=>setCabangOpts(j.data||[]))
  }, [])

  async function fetchData(){
    setLoading(true)
    const p = new URLSearchParams()
    p.set('jenis', jenis)
    if(q) p.set('q', q)
    if(st==='0' || st==='1') p.set('status', st)
    if(ord==='qty' || ord==='uang') p.set('order', ord)
    if(soldOnly) p.set('sold_only', '1')
    if(cabang) p.set('cabang', cabang)
    if(ready!=='') p.set('ready', ready)
    p.set('page', meta.page)
    p.set('limit', meta.limit)
    try{
      const res = await fetch(`${API_BASE}/api/aset/aset/master?${p.toString()}`)
      const json = await res.json()
      setRows(json.data || [])
      setMeta(json.meta || { page: 1, limit: 20, total: 0, totalPages: 0 })
    }catch(e){
    }finally{ setLoading(false) }
  }

  React.useEffect(() => { fetchData() }, [jenis])
  React.useEffect(() => { fetchData() }, [q, st, ord, soldOnly, meta.page, meta.limit, cabang, ready])

  async function updateStatus(id, to){
    try{
      const res = await fetch(`${API_BASE}/api/aset/aset/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jenis, id, status: to }) })
      const json = await res.json()
      if(json?.ok){
        setRows(rs=>rs.map(r=> (Number(r.id)===Number(id)) ? { ...r, status: to } : r))
      }
    }catch{}
  }

  return (
    <div className="">
      <h1 className="text-2xl font-semibold mb-2">{title}</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-2 mb-3">
        <input className="border rounded px-2 py-1" placeholder="Cari nama / SKU" value={q} onChange={e=>{ setMeta(m=>({ ...m, page: 1 })); setQ(e.target.value) }} />
        <select className="border rounded px-2 py-1" value={cabang} onChange={e=>{ setMeta(m=>({ ...m, page: 1 })); setCabang(e.target.value) }}>
          <option value="">Semua Cabang</option>
          {cabangOpts.map(c=>(
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <select className="border rounded px-2 py-1" value={ready} onChange={e=>{ setMeta(m=>({ ...m, page: 1 })); setReady(e.target.value) }}>
          <option value="">Semua Stok</option>
          <option value="1">Stok Tersedia</option>
          <option value="0">Stok Kosong</option>
        </select>
        <select className="border rounded px-2 py-1" value={st} onChange={e=>{ setMeta(m=>({ ...m, page: 1 })); setSt(e.target.value) }}>
          <option value="">Semua status</option>
          <option value="1">Aktif</option>
          <option value="0">Nonaktif</option>
        </select>
        <select className="border rounded px-2 py-1" value={ord} onChange={e=>{ setMeta(m=>({ ...m, page: 1 })); setOrd(e.target.value) }}>
          <option value="">Urut default</option>
          <option value="qty">Qty terjual terbanyak</option>
          <option value="uang">Uang terjual terbanyak</option>
        </select>
        <label className="inline-flex items-center gap-2 px-2 py-1 border rounded whitespace-nowrap">
          <input type="checkbox" checked={soldOnly} onChange={e=>{ setMeta(m=>({ ...m, page: 1 })); setSoldOnly(e.target.checked) }} />
          <span className="text-xs">Hanya terjual</span>
        </label>
        <select className="border rounded px-2 py-1 text-xs" value={meta.limit} onChange={e=>setMeta(m=>({ ...m, page: 1, limit: parseInt(e.target.value,10) }))}>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={200}>200</option>
        </select>
        <button className="border rounded px-3 bg-slate-900 text-white" onClick={fetchData} disabled={loading}>{loading ? '...' : 'Filter'}</button>
      </div>

      <div className={containerClass}>
        <table className={tableClass}>
          <thead className={theadClass}>
            <tr>
              <th className="p-2 text-left">No</th>
              <th className="p-2 text-left">Nama</th>
              <th className="p-2 text-left">SKU</th>
              <th className="p-2 text-right">Modal</th>
              <th className="p-2 text-right">Jual</th>
              <th className="p-2 text-right">Stok</th>
              <th className="p-2 text-right">Terjual (Qty)</th>
              <th className="p-2 text-right">Terjual (Rp)</th>
              <th className="p-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableBodySkeleton rows={10} cols={9} />
            ) : (
              <>
                {rows.map((r, idx) => (
                  <tr key={idx} className="border-t hover:bg-slate-50">
                    <td className="p-2">{(meta.page-1)*meta.limit + idx + 1}</td>
                    <td className="p-2">
                      <div className="font-medium text-slate-900">
                        <ProductTransactionDetailTrigger jenis={jenis} productId={r.id}>
                          {r.nama}
                        </ProductTransactionDetailTrigger>
                      </div>
                    </td>
                    <td className="p-2 font-mono text-xs">{r.sku}</td>
                    <td className="p-2 text-right">{fmtCurrency(r.harga_modal)}</td>
                    <td className="p-2 text-right font-semibold">{fmtCurrency(r.harga_jual)}</td>
                    <td className="p-2 text-right">
                      {(() => {
                        const bStocks = r.branch_stocks ? r.branch_stocks.split(',') : [];
                        const selectedStok = cabang ? (bStocks.find(x => x.startsWith(`${cabang}:`))?.split(':')[1] || 0) : r.total_stok;
                        const hasOtherStock = cabang && Number(selectedStok) < Number(r.total_stok);
                        
                        return (
                          <div className="flex flex-col items-end">
                            <div className="flex items-center gap-1">
                              <span className="font-bold text-blue-700">{fmtCurrency(selectedStok)}</span>
                              {hasOtherStock && (
                                <span className="text-[10px] text-slate-400 font-normal">(Total: {fmtCurrency(r.total_stok)})</span>
                              )}
                            </div>
                            {r.branch_stocks && (
                              <div className="text-[9px] leading-tight text-slate-500 mt-0.5 text-right grid grid-cols-2 gap-x-2">
                                {r.branch_stocks.split(',')
                                  .filter(bs => !cabang || String(bs.split(':')[0]) === String(cabang))
                                  .sort((a,b)=>parseInt(a.split(':')[1]) - parseInt(b.split(':')[1]))
                                  .reverse()
                                  .map(bs => {
                                    const [cid, s] = bs.split(':')
                                    const cname = (cabangOpts.find(co => String(co.value) === String(cid))?.label || `C${cid}`).split(' ').slice(0,2).join(' ')
                                    return (Number(s) > 0) ? (
                                      <React.Fragment key={cid}>
                                        <span className={String(cabang)===String(cid) ? 'font-bold text-slate-800' : ''}>{cname}:</span>
                                        <span className={String(cabang)===String(cid) ? 'font-bold text-slate-800' : ''}>{s}</span>
                                      </React.Fragment>
                                    ) : null
                                  })}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="p-2 text-right">{fmtCurrency(r.total_qty)}</td>
                    <td className="p-2 text-right font-medium text-green-700">{fmtCurrency(r.total_uang)}</td>
                    <td className="p-2">
                      <div className="flex flex-col items-start gap-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${Number(r.status ?? 1)===1 ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-700'}`}>{Number(r.status ?? 1)===1 ? 'Aktif' : 'Nonaktif'}</span>
                        <button className="text-[10px] underline text-primary" onClick={()=>updateStatus(r.id, Number(r.status ?? 1)===1 ? 0 : 1)}>{Number(r.status ?? 1)===1 ? 'Nonaktifkan' : 'Aktifkan'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length===0 && (
                  <tr><td className="p-3 text-center" colSpan={9}>Tidak ada data</td></tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        className="mt-3"
        page={meta.page}
        totalPages={meta.totalPages}
        total={meta.total}
        disabledPrev={meta.page<=1 || loading}
        disabledNext={meta.page>=meta.totalPages || loading}
        onPrev={()=>setMeta(m=>({...m, page: Math.max(1, m.page-1)}))}
        onNext={()=>setMeta(m=>({...m, page: Math.min(m.totalPages, m.page+1)}))}
        onJump={(p)=>setMeta(m=>({...m, page: p }))}
      />
    </div>
  )
}