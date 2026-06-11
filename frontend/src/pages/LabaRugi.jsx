import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import Pagination from '@/components/ui/Pagination.jsx'
import MarketingTable from '@/components/reports/MarketingTable'
import LabaDetailTable from '@/components/reports/LabaDetailTable.jsx'
import { TableBodySkeleton } from '@/components/ui/TableSkeleton.jsx'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://reportsapi.optiklivina.com'

export default function LabaRugi(){
  const [filters, setFilters] = useState({ pembukuan_id: '', cabang: '', marketing: '' })
  const [activePembukuan, setActivePembukuan] = useState(null)
  const [listPembukuan, setListPembukuan] = useState([])
  const [cabangOpts, setCabangOpts] = useState([])
  const [marketingOpts, setMarketingOpts] = useState([])
  const [data, setData] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('tabel')
  const [savingSupabase, setSavingSupabase] = useState(false)
  const [supabaseData, setSupabaseData] = useState(null)
  const [compareData, setCompareData] = useState(null)
  const [showMkModal, setShowMkModal] = useState(false)
  const [mkRows, setMkRows] = useState([])
  const [mkMeta, setMkMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [mkLoading, setMkLoading] = useState(false)
  const [mkOpenRows, setMkOpenRows] = useState({})
  const [mkItemsMap, setMkItemsMap] = useState({})
  const [mkQ, setMkQ] = useState('')
  const [mkStatus, setMkStatus] = useState('')
  const [mkCabangOverride, setMkCabangOverride] = useState(null)
  const [showLabaDetail, setShowLabaDetail] = useState(false)
  const [labaRows, setLabaRows] = useState([])

  useEffect(() => {
    async function init(){
      const [activeRes, listRes, cRes] = await Promise.all([
        fetch(`${API_BASE}/api/pembukuan/active`),
        fetch(`${API_BASE}/api/pembukuan/list`),
        fetch(`${API_BASE}/api/options/cabang`)
      ])
      const activeJson = await activeRes.json()
      const listJson = await listRes.json()
      const cJson = await cRes.json()
      setActivePembukuan(activeJson.data || null)
      setListPembukuan(listJson.data || [])
      setCabangOpts(cJson.data || [])
      if(activeJson.data && activeJson.data.id_toko_tutup){
        setFilters(f => ({ ...f, pembukuan_id: String(activeJson.data.id_toko_tutup) }))
      }
    }
    init()
  }, [])

  useEffect(() => {
    async function refetchMarketing(){
      const cabangId = filters.cabang || ''
      const url = cabangId ? `${API_BASE}/api/options/marketing?cabangId=${cabangId}` : `${API_BASE}/api/options/marketing`
      const res = await fetch(url)
      const json = await res.json()
      setMarketingOpts(json.data || [])
    }
    setFilters(f => ({ ...f, marketing: '' }))
    refetchMarketing()
  }, [filters.cabang])

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    if(filters.pembukuan_id){ p.set('pembukuan_id', filters.pembukuan_id) }
    if(filters.cabang){ p.set('cabang', filters.cabang) }
    if(filters.marketing){ p.set('marketing', filters.marketing) }
    return p.toString()
  }, [filters])

  async function fetchData(){
    setLoading(true)
    try{
      const res = await fetch(`${API_BASE}/api/reports/laba-rugi${qs ? `?${qs}` : ''}`)
      const json = await res.json()
      setData(json.data || null)
      if(filters.pembukuan_id){
        const res2 = await fetch(`${API_BASE}/api/reports/laba-rugi/by-cabang?pembukuan_id=${filters.pembukuan_id}`)
        const json2 = await res2.json()
        setRows(Array.isArray(json2.data) ? json2.data : [])
      }
      alert('Berhasil memuat Laba Rugi')
    }catch(e){
      console.error(e)
      alert('Gagal memuat Laba Rugi')
    }finally{
      setLoading(false)
    }
  }

  useEffect(() => {
    if(filters.pembukuan_id){ fetchData() }
  }, [filters.pembukuan_id, filters.cabang, filters.marketing])

  async function saveToSupabase(){
    if(!filters.pembukuan_id) return alert('Pilih pembukuan dulu')
    setSavingSupabase(true)
    try{
      const params = new URLSearchParams()
      params.set('pembukuan_id', filters.pembukuan_id)
      if(filters.cabang) params.set('cabang', filters.cabang)
      if(filters.marketing) params.set('marketing', filters.marketing)
      const res = await fetch(`${API_BASE}/api/reports/laba-rugi/supabase/save`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ pembukuan_id: Number(filters.pembukuan_id||0), cabang: filters.cabang ? Number(filters.cabang) : undefined, marketing: filters.marketing ? Number(filters.marketing) : undefined }) })
      const json = await res.json()
      if(res.ok){
        setSupabaseData(json.data || null)
        alert('Berhasil menyimpan ke Supabase')
      }else{
        alert(json.error || 'Gagal menyimpan ke Supabase')
      }
    }catch(e){
      alert('Gagal menyimpan ke Supabase')
    }finally{
      setSavingSupabase(false)
    }
  }

  async function fetchSupabase(){
    if(!filters.pembukuan_id) return alert('Pilih pembukuan dulu')
    try{
      const params = new URLSearchParams()
      params.set('pembukuan_id', filters.pembukuan_id)
      if(filters.cabang) params.set('cabang', filters.cabang)
      if(filters.marketing) params.set('marketing', filters.marketing)
      const res = await fetch(`${API_BASE}/api/reports/laba-rugi/supabase/get?${params.toString()}`)
      const json = await res.json()
      if(res.ok){ setSupabaseData(json.data || null); alert('Berhasil mengambil dari Supabase') }
      else{ alert(json.error || 'Gagal mengambil dari Supabase') }
    }catch(e){ alert('Gagal mengambil dari Supabase') }
  }

  async function fetchComparison(){
    if(!filters.pembukuan_id) return alert('Pilih pembukuan dulu')
    try{
      const params = new URLSearchParams()
      params.set('pembukuan_id', filters.pembukuan_id)
      if(filters.cabang) params.set('cabang', filters.cabang)
      if(filters.marketing) params.set('marketing', filters.marketing)
      const res = await fetch(`${API_BASE}/api/reports/laba-rugi/compare-previous?${params.toString()}`)
      const json = await res.json()
      if(res.ok){ setCompareData(json.data || null); setTab('grafik'); alert('Berhasil memuat perbandingan') }
      else{ alert(json.error || 'Gagal memuat perbandingan') }
    }catch(e){ alert('Gagal memuat perbandingan') }
  }

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setShowMkModal(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const mkTotals = useMemo(() => {
    const fix = mkRows.reduce((a,r)=>a+Number(r.fix_harga||0),0)
    const ongkir = mkRows.reduce((a,r)=>a+Number(r.ongkir_items||0),0)
    const bayar = mkRows.reduce((a,r)=>a+Number(r.jml_bayar||0),0)
    const sisa = mkRows.reduce((a,r)=>a+Number(r.sisa_bayar||0),0)
    const laba = mkRows.reduce((a,r)=>a+Number(r.laba_items||0),0)
    const laba_est = mkRows.reduce((a,r)=>a+(Number(r.sisa_bayar||0)>0?Number(r.laba_items||0):0),0)
    const laba_paid = mkRows.reduce((a,r)=>a+((Number(r.sisa_bayar||0)<=0)?Number(r.laba_items||0):0),0)
    return { fix, ongkir, bayar, sisa, laba, laba_est, laba_paid }
  }, [mkRows])

  async function fetchMarketingModal(nextPage = 1){
    setMkLoading(true)
    try{
      const params = new URLSearchParams()
      if(filters.pembukuan_id){ params.set('pembukuan_id', filters.pembukuan_id) }
      const cabangParam = mkCabangOverride || filters.cabang
      if(cabangParam){ params.set('cabang', cabangParam) }
      if(filters.marketing){ params.set('marketing', filters.marketing) }
      params.set('page', nextPage)
      params.set('limit', mkMeta.limit)
      params.set('include_sums', '1')
      if(mkQ){ params.set('q', mkQ) }
      if(mkStatus){ params.set('status', mkStatus) }
      const res = await fetch(`${API_BASE}/api/marketing/marketing-payments?${params.toString()}`)
      const json = await res.json()
      setMkRows(json.data || [])
      const incomingMeta = json.meta || { page: nextPage, limit: mkMeta.limit, total: 0, totalPages: 0 }
      setMkMeta(incomingMeta)
    }catch(e){
    }finally{
      setMkLoading(false)
    }
  }

  function openMkModalForCabang(id){
    setMkCabangOverride(id)
    setShowMkModal(true)
    setMkMeta(m=>({ ...m, page: 1 }))
    fetchMarketingModal(1)
  }

  async function openLabaDetailForCabang(id){
    setShowLabaDetail(true)
    setLabaRows(null)
    try{
      const params = new URLSearchParams()
      if(filters.pembukuan_id) params.set('pembukuan_id', filters.pembukuan_id)
      params.set('cabang', id)
      const res = await fetch(`${API_BASE}/api/reports/laba-rugi/details?${params.toString()}`)
      const json = await res.json()
      setLabaRows(json.data || [])
    }catch(e){ setLabaRows([]) }
  }

  return (
    <div className="pb-6">
      <h1 className="text-2xl font-semibold mb-1">Laba Rugi</h1>
      {activePembukuan && (
        <p className="mb-3 text-sm text-slate-600">Pembukuan aktif: {formatDate(activePembukuan.tanggal_buka_buku)} — {formatDate(activePembukuan.tanggal_tutup_buku)}</p>
      )}
      <div className="mb-3 flex items-center gap-2">
        <button className={`px-3 py-1 rounded border ${tab==='tabel'?'bg-slate-800 text-white':'bg-white'}`} onClick={()=>setTab('tabel')}>Tabel</button>
        <button className={`px-3 py-1 rounded border ${tab==='grafik'?'bg-slate-800 text-white':'bg-white'}`} onClick={()=>setTab('grafik')}>Grafik</button>
        <div className="flex-1"></div>
        <Button onClick={saveToSupabase} disabled={savingSupabase || !filters.pembukuan_id}>{savingSupabase ? 'Menyimpan...' : 'Cek Laba Rugi (Simpan ke Supabase)'}</Button>
        <Button variant="outline" onClick={fetchSupabase} disabled={!filters.pembukuan_id}>Ambil Ulang dari Supabase</Button>
        <Button variant="outline" onClick={fetchComparison} disabled={!filters.pembukuan_id}>Bandingkan dgn Pembukuan Sebelumnya</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4">
        <select className="border rounded px-2 py-1" value={filters.pembukuan_id} onChange={e=>setFilters(f=>({...f, pembukuan_id:e.target.value}))}>
          <option value="">Pilih pembukuan</option>
          {listPembukuan.map(p => (
            <option key={p.id_toko_tutup} value={p.id_toko_tutup}>
              {p.tanggal_buka_buku} — {p.tanggal_tutup_buku}
            </option>
          ))}
        </select>
        <select className="border rounded px-2 py-1" value={filters.cabang} onChange={e=>setFilters(f=>({...f, cabang:e.target.value}))}>
          <option value="">Pilih cabang</option>
          {cabangOpts.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <select className="border rounded px-2 py-1" value={filters.marketing} onChange={e=>setFilters(f=>({...f, marketing:e.target.value}))}>
          <option value="">Pilih marketing</option>
          {marketingOpts.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        <button className="border rounded px-2 py-1" onClick={fetchData} disabled={loading}>{loading ? 'Memuat...' : 'Refresh'}</button>
      </div>
      {tab==='tabel' && (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card title="Omset Toko" value={fmtCurrency(data?.omset_toko)} />
        <Card title="Omset Marketing" value={fmtCurrency(data?.omset_marketing)} onClick={() => { setMkCabangOverride(null); setShowMkModal(true); setMkMeta(m=>({ ...m, page: 1 })); fetchMarketingModal(1) }} clickable />
        <Card title="Modal" value={fmtCurrency(data?.modal)} />
        <Card title="Ongkir" value={fmtCurrency(data?.ongkir)} />
        <Card title="Pengeluaran (Modal Table)" value={fmtCurrency(data?.pengeluaran)} />
        <Card title="Laba" value={fmtCurrency(data?.laba)} />
        <Card title="Rugi" value={fmtCurrency(data?.rugi)} />
        <Card title="Laba Bersih" value={fmtCurrency(data?.laba_bersih)} />
      </div>
      )}

      {tab==='grafik' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div className="p-3 border rounded bg-slate-50">
            <div className="font-semibold mb-2">Grafik Omset & Biaya</div>
            <div className="space-y-1">
              <Bar label="Omset Toko" value={Number(data?.omset_toko||0)} max={maxChart(data)} />
              <Bar label="Omset Marketing" value={Number(data?.omset_marketing||0)} max={maxChart(data)} />
              <Bar label="Modal" value={Number(data?.modal||0)} max={maxChart(data)} />
              <Bar label="Ongkir" value={Number(data?.ongkir||0)} max={maxChart(data)} />
              <Bar label="Pengeluaran" value={Number(data?.pengeluaran||0)} max={maxChart(data)} />
            </div>
          </div>
          <div className="p-3 border rounded bg-slate-50">
            <div className="font-semibold mb-2">Laba/Rugi</div>
            <div className="space-y-1">
              <Bar label="Laba" value={Number(data?.laba||0)} max={maxChart(data)} />
              <Bar label="Rugi" value={Number(data?.rugi||0)} max={maxChart(data)} />
              <Bar label="Laba Bersih" value={Number(data?.laba_bersih||0)} max={maxChart(data)} />
            </div>
          </div>
          {compareData && (
            <div className="p-3 border rounded bg-slate-50 md:col-span-2">
              <div className="font-semibold mb-2">Perbandingan Pembukuan</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-sm mb-1">Saat ini</div>
                  <Bar label="Laba Bersih" value={Number(compareData?.current?.laba_bersih||0)} max={Math.max(Math.abs(Number(compareData?.current?.laba_bersih||0)), Math.abs(Number(compareData?.previous?.laba_bersih||0)), 1)} />
                </div>
                <div>
                  <div className="text-sm mb-1">Sebelumnya</div>
                  <Bar label="Laba Bersih" value={Number(compareData?.previous?.laba_bersih||0)} max={Math.max(Math.abs(Number(compareData?.current?.laba_bersih||0)), Math.abs(Number(compareData?.previous?.laba_bersih||0)), 1)} />
                </div>
              </div>
            </div>
          )}
          {!filters.cabang && rows && rows.length>0 && (
            <div className="p-3 border rounded bg-slate-50 md:col-span-2">
              <div className="font-semibold mb-2">Laba/Rugi per Cabang</div>
              <div className="space-y-1 max-h-[60vh] overflow-auto">
                {rows.map(r => (
                  <Bar key={r.id_cabang} label={r.nama_cabang} value={Number(r.total_laba||0)} max={Math.max(...rows.map(x=>Math.abs(Number(x.total_laba||0))),1)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab==='tabel' && (
      <div className="mt-6 overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-2 text-left">No</th>
              <th className="p-2 text-left">Cabang</th>
              <th className="p-2 text-right">Omset Toko</th>
              <th className="p-2 text-right">Omset Marketing</th>
              <th className="p-2 text-right">Total Omset</th>
              <th className="p-2 text-right">Modal</th>
              <th className="p-2 text-right">Ongkir</th>
              <th className="p-2 text-right">Pengeluaran</th>
              <th className="p-2 text-right">Omset Bersih</th>
              <th className="p-2 text-right">Total Laba</th>
              <th className="p-2 text-right">Laba Aktual</th>
              <th className="p-2 text-right">Laba Estimasi</th>
              <th className="p-2 text-right">Laba Akumulasi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableBodySkeleton rows={10} cols={13} />
            ) : rows.map((r, idx)=>(
              <tr key={r.id_cabang} className="border-t">
                <td className="p-2">{idx+1}</td>
                <td className="p-2">{r.nama_cabang}</td>
                <td className="p-2 text-right">{fmtCurrency(r.omset_toko)}</td>
                <td className="p-2 text-right"><button className="underline" onClick={()=>openMkModalForCabang(r.id_cabang)}>{fmtCurrency(r.omset_marketing)}</button></td>
                <td className="p-2 text-right">{fmtCurrency(r.total_omset)}</td>
                <td className="p-2 text-right">{fmtCurrency(r.modal)}</td>
                <td className="p-2 text-right">{fmtCurrency(r.ongkir)}</td>
                <td className="p-2 text-right">{fmtCurrency(r.pengeluaran)}</td>
                <td className="p-2 text-right">{fmtCurrency(r.omset_bersih)}</td>
                <td className="p-2 text-right">{fmtCurrency(r.total_laba)}</td>
                <td className="p-2 text-right">{fmtCurrency(r.laba_aktual)}</td>
                <td className="p-2 text-right">{fmtCurrency(r.laba_estimasi)}</td>
                <td className="p-2 text-right">{fmtCurrency(r.laba_akumulasi)} <button className="underline ml-2" onClick={()=>openLabaDetailForCabang(r.id_cabang)}>Detail</button></td>
              </tr>
            ))}
            {!loading && rows.length===0 && (
              <tr><td className="p-3" colSpan={13}>Tidak ada data</td></tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {showMkModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={()=>setShowMkModal(false)}>
          <div className="bg-white rounded shadow w-[1100px] max-w-[95%] max-h-[90vh] overflow-auto" onClick={(e)=>e.stopPropagation()}>
            <div className="p-3 border-b flex items-center justify-between">
              <div className="text-sm font-semibold">Transaksi Omset Marketing</div>
              <div className="flex items-center gap-2">
                <Button onClick={()=>setShowMkModal(false)}>Tutup</Button>
              </div>
            </div>
            <div className="p-3 flex flex-wrap items-center gap-2 border-b">
              <input className="border rounded px-2 py-1 w-[220px]" placeholder="Cari..." value={mkQ} onChange={e=>setMkQ(e.target.value)} />
              <select className="border rounded px-2 py-1" value={mkStatus} onChange={e=>setMkStatus(e.target.value)}>
                <option value="">Semua status</option>
                <option value="lunas">Lunas</option>
                <option value="belum">Belum Lunas</option>
              </select>
              <select className="border rounded px-2 py-1" value={mkMeta.limit} onChange={e=>setMkMeta(m=>({ ...m, page: 1, limit: parseInt(e.target.value,10) }))}>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={1000}>Semua</option>
              </select>
              <Button onClick={()=>fetchMarketingModal(1)} disabled={mkLoading}>{mkLoading ? 'Memuat...' : 'Filter'}</Button>
            </div>
            <div className="p-3">
              <MarketingTable rows={mkRows} totals={mkTotals} openRows={mkOpenRows} setOpenRows={setMkOpenRows} itemsMap={mkItemsMap} setItemsMap={setMkItemsMap} loading={mkLoading} />
              <Pagination
                className="mt-3"
                page={mkMeta.page}
                totalPages={mkMeta.totalPages}
                total={mkMeta.total}
                disabledPrev={mkMeta.limit>=1000 || mkMeta.page<=1 || mkLoading}
                disabledNext={mkMeta.limit>=1000 || mkMeta.page>=mkMeta.totalPages || mkLoading}
                onPrev={()=>fetchMarketingModal(Math.max(1, mkMeta.page-1))}
                onNext={()=>fetchMarketingModal(Math.min(mkMeta.totalPages, mkMeta.page+1))}
              />
            </div>
          </div>
        </div>
      )}

      {showLabaDetail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={()=>setShowLabaDetail(false)}>
          <div className="bg-white rounded shadow w-[1100px] max-w-[95%] max-h-[90vh] overflow-auto" onClick={(e)=>e.stopPropagation()}>
            <div className="p-3 border-b flex items-center justify-between">
              <div className="text-sm font-semibold">Detail Laba</div>
              <div className="flex items-center gap-2">
                <Button onClick={()=>setShowLabaDetail(false)}>Tutup</Button>
              </div>
            </div>
            <div className="p-3">
              <LabaDetailTable rows={labaRows || []} loading={labaRows===null} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Card({ title, value, onClick, clickable }){
  const cls = clickable ? 'p-3 border rounded bg-slate-50 cursor-pointer hover:bg-slate-100' : 'p-3 border rounded bg-slate-50'
  return (
    <div className={cls} onClick={onClick}>
      <div className="text-sm text-slate-600">{title}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  )
}

function fmtCurrency(n){
  return Math.round(Number(n||0)).toLocaleString('id-ID')
}

function formatDate(s){
  if(!s) return ''
  if(typeof s === 'string') return s.slice(0,10)
  try{ return new Date(s).toLocaleDateString('id-ID') }catch{ return String(s) }
}

function maxChart(d){
  const vals = [Number(d?.omset_toko||0), Number(d?.omset_marketing||0), Number(d?.modal||0), Number(d?.ongkir||0), Number(d?.pengeluaran||0), Number(d?.laba||0), Number(d?.rugi||0), Number(d?.laba_bersih||0)]
  return Math.max(...vals.map(v=>Math.abs(v)), 1)
}

function Bar({ label, value, max }){
  const v = Number(value||0)
  const pct = max>0 ? (Math.abs(v)/Number(max))*100 : 0
  const color = v < 0 ? 'bg-red-600' : 'bg-slate-600'
  return (
    <div className="flex items-center gap-2">
      <div className="w-40 text-xs truncate">{label}</div>
      <div className="flex-1 h-4 bg-slate-200 rounded">
        <div className={`h-4 ${color} rounded`} style={{ width: `${Math.max(4, pct)}%` }}></div>
      </div>
      <div className="w-32 text-right text-xs">{fmtCurrency(v)}</div>
    </div>
  )
}
