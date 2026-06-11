import React, { useEffect, useState, useMemo } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://reportsapi.optiklivina.com'

export default function AsetIdleExport(){
  const params = new URLSearchParams(window.location.hash.split('?')[1]||'')
  const cabang = params.get('cabang') || ''
  const months = parseInt(params.get('months')||'3',10)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchData() }, [cabang, months])

  async function fetchData(){
    setError('')
    if(!cabang){ setError('Parameter cabang wajib'); return }
    setLoading(true)
    try{
      const url = `${API_BASE}/api/reports/aset/idle?cabang=${cabang}&months=${months}`
      const res = await fetch(url)
      if(!res.ok){ setError(`Gagal memuat (status ${res.status})`); setLoading(false); return }
      const json = await res.json()
      setRows(json.data || [])
    }catch(e){ setError(String(e)) }
    setLoading(false)
  }

  const csv = useMemo(() => {
    const header = ['Jenis','Nama','SKU','Stok','Modal','Jual','Terakhir Jual','Nilai Aset','Usia (bulan)']
    const lines = [header.join(',')]
    for(const r of rows){
      const nilai = Number(r.harga_modal||0)*Number(r.stok||0)
      lines.push([
        r.jenis,
        toCsv(r.nama),
        toCsv(r.sku),
        Number(r.stok||0),
        Number(r.harga_modal||0),
        Number(r.harga_jual||0),
        formatDate(r.last_log),
        nilai,
        Number(r.months_since_log||0)
      ].join(','))
    }
    return lines.join('\n')
  }, [rows])

  function downloadCsv(){
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `aset-idle-cabang-${cabang}-months-${months}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function printPage(){ window.print() }

  return (
    <div className="w-full min-h-screen p-6">
      <h1 className="text-2xl font-semibold mb-2">Export Aset Tidak Berjalan</h1>
      <p className="mb-3 text-sm text-slate-600">Cabang: {cabang} • Periode: ≥ {months} bulan</p>
      <div className="flex items-center gap-2 mb-4">
        <button className="h-9 px-4 py-2 bg-orange-600 text-white rounded" onClick={downloadCsv}>Download CSV</button>
        <button className="h-9 px-4 py-2 bg-slate-900 text-white rounded" onClick={printPage}>Print</button>
      </div>
      {error && (<div className="p-3 border rounded bg-red-50 text-red-700 mb-3 text-sm">{error}</div>)}
      <div className="overflow-x-auto border rounded">
        <table className="min-w-full w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-2 text-left">Jenis</th>
              <th className="p-2 text-left">Nama</th>
              <th className="p-2 text-left">SKU</th>
              <th className="p-2 text-right">Stok</th>
              <th className="p-2 text-right">Modal</th>
              <th className="p-2 text-right">Jual</th>
              <th className="p-2 text-left">Terakhir Jual</th>
              <th className="p-2 text-right">Nilai Aset</th>
              <th className="p-2 text-right">Usia (bulan)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx} className="border-t">
                <td className="p-2">{r.jenis}</td>
                <td className="p-2">{r.nama}</td>
                <td className="p-2">{r.sku}</td>
                <td className="p-2 text-right">{fmtCurrency(r.stok)}</td>
                <td className="p-2 text-right">{fmtCurrency(r.harga_modal)}</td>
                <td className="p-2 text-right">{fmtCurrency(r.harga_jual)}</td>
                <td className="p-2">{formatDate(r.last_log)}</td>
                <td className="p-2 text-right">{fmtCurrency(Number(r.harga_modal||0)*Number(r.stok||0))}</td>
                <td className="p-2 text-right">{r.months_since_log}</td>
              </tr>
            ))}
            {(!loading && rows.length===0) && (
              <tr><td className="p-3" colSpan={9}>Tidak ada data</td></tr>
            )}
            {(loading) && (
              <tr><td className="p-3" colSpan={9}>Memuat...</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function fmtCurrency(n){ return Number(n||0).toLocaleString('id-ID') }
function formatDate(s){ if(!s) return ''; if(typeof s==='string') return s.slice(0,10); try{ return new Date(s).toLocaleDateString('id-ID') }catch{ return String(s) } }
function toCsv(v){ return String(v||'').replace(/"/g,'""') }
