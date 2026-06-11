import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { TableBodySkeleton } from '@/components/ui/TableSkeleton.jsx'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://reportsapi.optiklivina.com'

export default function AnalysisCabangTop() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(null)
  const [pembukuan, setPembukuan] = useState('')
  const [listPembukuan, setListPembukuan] = useState([])


  useEffect(() => {
    async function init() {
      const res = await fetch(`${API_BASE}/api/pembukuan/active`)
      const json = await res.json()
      setActive(json.data || null)
      const id = json?.data?.id_toko_tutup ? String(json.data.id_toko_tutup) : ''
      setPembukuan(id)
      const resList = await fetch(`${API_BASE}/api/pembukuan/list`)
      const jsonList = await resList.json()
      setListPembukuan(jsonList.data || [])
    }
    init()
  }, [])

  async function fetchData() {
    if (!pembukuan) return
    setLoading(true)
    const url = `${API_BASE}/api/omset/analysis-cabang?pembukuan_id=${pembukuan}`
    const res = await fetch(url)
    const json = await res.json()
    setRows(json.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [pembukuan])

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-3">
        <a href="#/" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 bg-slate-900 text-white hover:bg-slate-700 h-9 px-4 py-2">Kembali</a>
        <div className="flex items-center gap-2">
          <label className="text-sm">Pembukuan:</label>
          <select className="border rounded px-2 py-1 text-sm" value={pembukuan} onChange={e => setPembukuan(e.target.value)}>
            {listPembukuan.map(p => (
              <option key={p.id_toko_tutup} value={p.id_toko_tutup}>
                #{p.id_toko_tutup} — {formatDate(p.tanggal_buka_buku)} — {formatDate(p.tanggal_tutup_buku)}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={fetchData} disabled={loading}>{loading ? 'Memuat...' : 'Refresh'}</Button>
      </div>
      <h1 className="text-2xl font-semibold mb-1">Analisis Cabang (Top)</h1>
      {pembukuan && (
        <p className="mb-3 text-sm text-slate-600">Pembukuan: {formatDate((listPembukuan.find(p => String(p.id_toko_tutup) === String(pembukuan)) || active)?.tanggal_buka_buku)} — {formatDate((listPembukuan.find(p => String(p.id_toko_tutup) === String(pembukuan)) || active)?.tanggal_tutup_buku)}</p>
      )}

      <div className="overflow-auto border rounded shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 uppercase text-[10px] font-bold text-slate-600 tracking-wider">
            <tr>
              <th className="p-2 text-left w-12">No</th>
              <th className="p-2 text-left">Nama Cabang</th>
              <th className="p-2 text-right">Omset MK</th>
              <th className="p-2 text-right">Omset Toko</th>
              <th className="p-2 text-right">Laba MK</th>
              <th className="p-2 text-right">Laba Toko</th>
              <th className="p-2 text-right">% Bayar MK</th>
              <th className="p-2 text-right">Kacamata</th>
              <th className="p-2 text-right">GL</th>
              <th className="p-2 text-right">Frame</th>
              <th className="p-2 text-right">Softlens</th>
              <th className="p-2 text-left w-20">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableBodySkeleton rows={10} cols={12} />
            ) : rows.map((r, idx) => (
              <React.Fragment key={r.id_cabang}>
                <tr className="border-t hover:bg-slate-50 transition-colors">
                  <td className="p-2 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                  <td className="p-2 font-medium">{r.nama_cabang || r.id_cabang}</td>
                  <td className="p-2 text-right tabular-nums">{fmtCurrency(r.omset_marketing)}</td>
                  <td className="p-2 text-right tabular-nums">{fmtCurrency(r.omset_toko)}</td>
                  <td className="p-2 text-right tabular-nums">{fmtCurrency(r.laba_marketing)}</td>
                  <td className="p-2 text-right tabular-nums">{fmtCurrency(r.laba_toko)}</td>
                  <td className="p-2 text-right tabular-nums font-semibold">{fmtPercent(r.persen_bayar_marketing)}</td>
                  <td className="p-2 text-right tabular-nums text-slate-500">{fmtCurrency(r.qty_kacamata)}</td>
                  <td className="p-2 text-right tabular-nums text-slate-500">{fmtCurrency(r.qty_gl)}</td>
                  <td className="p-2 text-right tabular-nums text-slate-500">{fmtCurrency(r.qty_frame)}</td>
                  <td className="p-2 text-right tabular-nums text-slate-500">{fmtCurrency(r.qty_softlens)}</td>
                  <td className="p-2"><DetailButtonCabang cabangId={r.id_cabang} namaCabang={r.nama_cabang} pembukuanId={pembukuan} /></td>
                </tr>
              </React.Fragment>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td className="p-3 text-center text-slate-400 font-medium" colSpan={12}>Tidak ada data untuk periode ini</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function fmtCurrency(n) { return Number(n || 0).toLocaleString('id-ID') }
function fmtPercent(n) { return `${(Number(n || 0)).toFixed(2)}%` }
function formatDate(s) { if (!s) return ''; if (typeof s === 'string') return s.slice(0, 10); try { return new Date(s).toLocaleDateString('id-ID') } catch { return String(s) } }

function DetailButtonCabang({ cabangId, namaCabang, pembukuanId }) {
  const navigate = () => {
    if (!pembukuanId || !cabangId) return
    const nama = encodeURIComponent(namaCabang || '')
    window.location.hash = `#/analysis?cabang=${cabangId}&nama=${nama}&pembukuan_id=${pembukuanId}`
  }
  return <Button onClick={navigate} disabled={!pembukuanId}>Detail</Button>
}

// removed inline detail row; navigation opens AnalysisCabang page
