import React, { useEffect, useState, useMemo, useRef } from 'react'
import { TableBodySkeleton } from '@/components/ui/TableSkeleton.jsx'
import ProductTransactionDetailTrigger from '@/components/aset/ProductTransactionDetailTrigger.jsx'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://reportsapi.optiklivina.com'

export default function Aset() {
  const [cabang, setCabang] = useState('all')
  const [cabangOpts, setCabangOpts] = useState([])
  const [rows, setRows] = useState([])
  const [list, setList] = useState([])
  const [idleRows, setIdleRows] = useState([])
  const [months, setMonths] = useState(3)
  const [summary, setSummary] = useState({ total_aset: 0, estimasi_penjualan: 0, idle_3_bulan: 0, idle_6_bulan: 0, idle_1_tahun: 0, idle_gt_1_tahun: 0 })
  const [loading, setLoading] = useState(false)
  const [idleLoading, setIdleLoading] = useState(false)
  const [idleError, setIdleError] = useState('')
  const [idleSumAll, setIdleSumAll] = useState(0)
  const isAll = useMemo(() => (!cabang || cabang === 'all'), [cabang])
  const [showIdle, setShowIdle] = useState(false)

  useEffect(() => { initOptions() }, [])

  async function initOptions() {
    const res = await fetch(`${API_BASE}/api/options/cabang`)
    const json = await res.json()
    setCabangOpts(json.data || [])
  }

  async function fetchData() {
    setLoading(true)
    const isAll = !cabang || cabang === 'all'
    const url = !isAll ? `${API_BASE}/api/reports/aset?cabang=${cabang}` : `${API_BASE}/api/reports/aset?include_idle=1`
    const res = await fetch(url)
    const json = await res.json()
    if (!isAll) {
      setRows(json.data || [])
      setList([])
    } else {
      setList(json.data || [])
      setRows([])
      setShowIdle(false)
      setIdleRows([])
      setIdleError('')
    }
    setSummary(json.summary || { total_aset: 0, estimasi_penjualan: 0, idle_3_bulan: 0, idle_6_bulan: 0, idle_1_tahun: 0, idle_gt_1_tahun: 0 })
    setLoading(false)
  }

  async function updateStatus(jenis, id, to) {
    try {
      const res = await fetch(`${API_BASE}/api/aset/aset/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jenis, id, status: to }) })
      const json = await res.json()
      if (json?.ok) {
        if (Number(to) === 0) {
          setRows(rs => rs.filter(r => !(r.jenis === jenis && Number(r.id) === Number(id))))
          setIdleRows(rs => rs.filter(r => !(r.jenis === jenis && Number(r.id) === Number(id))))
        } else {
          setRows(rs => rs.map(r => (r.jenis === jenis && Number(r.id) === Number(id)) ? { ...r, status: to } : r))
          setIdleRows(rs => rs.map(r => (r.jenis === jenis && Number(r.id) === Number(id)) ? { ...r, status: to } : r))
        }
      }
    } catch { }
  }

  async function checkIdle() {
    setIdleError('')
    setIdleLoading(true)
    const isAll = !cabang || cabang === 'all'
    if (isAll) {
      const url = `${API_BASE}/api/reports/aset/idle-summary?months=${months}`
      try {
        const res = await fetch(url)
        if (!res.ok) {
          const txt = await res.text()
          setIdleError(`Gagal memuat (status ${res.status}). ${txt.slice(0, 120)}`)
          setIdleLoading(false)
          return
        }
        const json = await res.json()
        setIdleSumAll(Number(json?.summary?.total_aset || 0))
      } catch (e) {
        setIdleError(`Kesalahan jaringan: ${String(e).slice(0, 120)}`)
      }
      setIdleRows([])
      setShowIdle(false)
    } else {
      const url = `${API_BASE}/api/reports/aset/idle?cabang=${cabang}&months=${months}`
      try {
        const res = await fetch(url)
        if (!res.ok) {
          const txt = await res.text()
          setIdleError(`Gagal memuat (status ${res.status}). ${txt.slice(0, 120)}`)
          setIdleLoading(false)
          return
        }
        const json = await res.json()
        setIdleRows(json.data || [])
      } catch (e) {
        setIdleError(`Kesalahan jaringan: ${String(e).slice(0, 120)}`)
      }
      setShowIdle(true)
    }
    setIdleLoading(false)
  }

  const totals = useMemo(() => {
    const aset = rows.reduce((a, r) => a + (Number(r.harga_modal || 0) * Number(r.stok || 0)), 0)
    const est = rows.reduce((a, r) => a + (Number(r.harga_jual || 0) * Number(r.stok || 0)), 0)
    return { aset, est }
  }, [rows])

  const containerRef = useRef(null)
  function toggleFullscreen() {
    const el = containerRef.current
    if (!el) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      el.requestFullscreen?.()
    }
  }
  return (
    <div ref={containerRef} className="w-full min-h-screen px-2 md:px-4 lg:px-6 max-w-none">
      <h1 className="text-2xl font-semibold mb-2">Laporan Aset</h1>
      <div className="flex items-center gap-2 mb-3">
        <select className="border rounded px-2 py-1" value={cabang} onChange={e => setCabang(e.target.value)}>
          <option value="all">Semua cabang</option>
          {cabangOpts.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <button className="h-9 px-4 py-2 bg-slate-900 text-white rounded" onClick={fetchData} disabled={loading}>{loading ? 'Memuat...' : 'Tampilkan'}</button>
        <button className="h-9 px-3 py-2 bg-slate-200 rounded" onClick={toggleFullscreen}>Full Screen</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4 w-full">
        <div className="p-3 border rounded bg-slate-50">
          <div className="font-semibold mb-1">Total Aset (Modal)</div>
          <div className="text-lg">{fmtCurrency(summary.total_aset)}</div>
        </div>
        <div className="p-3 border rounded bg-slate-50">
          <div className="font-semibold mb-1">Estimasi Penjualan</div>
          <div className="text-lg">{fmtCurrency(summary.estimasi_penjualan)}</div>
        </div>
        <div className="p-3 border rounded bg-slate-50">
          <div className="font-semibold mb-1">Aset Tidak Berjalan</div>
          <div className="text-sm">≥3 bln: <b>{fmtCurrency(summary.idle_3_bulan)}</b></div>
          <div className="text-sm">≥6 bln: <b>{fmtCurrency(summary.idle_6_bulan)}</b></div>
          <div className="text-sm">≥1 thn: <b>{fmtCurrency(summary.idle_1_tahun)}</b></div>
          <div className="text-sm">≥2 thn: <b>{fmtCurrency(summary.idle_gt_1_tahun)}</b></div>
        </div>
      </div>
      {cabang && (
        <div className="flex items-center gap-2 mb-4">
          <select className="border rounded px-2 py-1" value={months} onChange={e => setMonths(parseInt(e.target.value, 10))}>
            <option value={3}>≥ 3 bulan</option>
            <option value={6}>≥ 6 bulan</option>
            <option value={12}>≥ 1 tahun</option>
            <option value={24}>≥ 2 tahun</option>
          </select>
          <button className="h-9 px-4 py-2 bg-orange-600 text-white rounded" onClick={checkIdle} disabled={idleLoading}>{idleLoading ? 'Memuat...' : 'CEK Aset Tidak Berjalan'}</button>
          {idleError && <span className="text-red-600 text-sm">{idleError}</span>}
          {showIdle && (
            <button className="h-9 px-3 py-2 bg-slate-200 text-slate-800 rounded" onClick={() => setShowIdle(false)}>Tutup hasil cek</button>
          )}
          {!isAll && (
            <button className="h-9 px-4 py-2 bg-green-600 text-white rounded" onClick={() => window.open(`#/aset-idle-export?cabang=${cabang}&months=${months}`, '_blank')}>Export View Detail</button>
          )}
        </div>
      )}
      {(isAll) && (
        <div className="overflow-x-auto border rounded w-full mt-4">
          <table className="min-w-full w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-2 text-left w-12">No</th>
                <th className="p-2 text-left">Cabang</th>
                <th className="p-2 text-right">Total Aset</th>
                <th className="p-2 text-right">Estimasi</th>
                <th className="p-2 text-right">≥3 bln</th>
                <th className="p-2 text-right">≥6 bln</th>
                <th className="p-2 text-right">≥1 thn</th>
                <th className="p-2 text-right">≥2 thn</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableBodySkeleton rows={10} cols={8} />
              ) : list.map((r, idx) => (
                <tr key={idx} className="border-t hover:bg-slate-50 transition-colors">
                  <td className="p-2 text-slate-500 font-mono text-xs">{idx + 1}</td>
                  <td className="p-2 font-medium">{r.nama_cabang}</td>
                  <td className="p-2 text-right tabular-nums">{fmtCurrency(r.total_aset)}</td>
                  <td className="p-2 text-right tabular-nums">{fmtCurrency(r.estimasi_penjualan)}</td>
                  <td className="p-2 text-right tabular-nums">{fmtCurrency(r.idle_3_bulan)}</td>
                  <td className="p-2 text-right tabular-nums">{fmtCurrency(r.idle_6_bulan)}</td>
                  <td className="p-2 text-right tabular-nums">{fmtCurrency(r.idle_1_tahun)}</td>
                  <td className="p-2 text-right tabular-nums">{fmtCurrency(r.idle_gt_1_tahun)}</td>
                </tr>
              ))}
              {!loading && list.length === 0 && (
                <tr><td className="p-3 text-center text-slate-500" colSpan={8}>Tidak ada data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {(!cabang && idleSumAll > 0) && (
        <div className="mt-3 p-3 border rounded bg-orange-50 text-sm">
          Total aset macet semua cabang ≥ {months} bulan: <b>{fmtCurrency(idleSumAll)}</b>
        </div>
      )}
      {(!isAll && !showIdle) && (
        <div className="overflow-x-auto border rounded">
          <table className="min-w-full w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-2 text-left w-12">No</th>
                <th className="p-2 text-left">Jenis</th>
                <th className="p-2 text-left">Nama</th>
                <th className="p-2 text-left">SKU</th>
                <th className="p-2 text-right">Stok</th>
                <th className="p-2 text-right">Modal</th>
                <th className="p-2 text-right">Jual</th>
                <th className="p-2 text-left">Terakhir Jual</th>
                <th className="p-2 text-right">Nilai Aset</th>
                <th className="p-2 text-right">Estimasi</th>
                <th className="p-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableBodySkeleton rows={10} cols={11} />
              ) : rows.map((r, idx) => (
                <tr key={idx} className="border-t hover:bg-slate-50 transition-colors">
                  <td className="p-2 text-slate-500 font-mono text-xs">{idx + 1}</td>
                  <td className="p-2">{r.jenis}</td>
                  <td className="p-2"><ProductTransactionDetailTrigger jenis={r.jenis} productId={r.id} cabangId={cabang}><span className="text-primary hover:underline cursor-pointer font-medium">{r.nama}</span></ProductTransactionDetailTrigger></td>
                  <td className="p-2 font-mono text-xs">{r.sku}</td>
                  <td className="p-2 text-right tabular-nums">{fmtCurrency(r.stok)}</td>
                  <td className="p-2 text-right tabular-nums">{fmtCurrency(r.harga_modal)}</td>
                  <td className="p-2 text-right tabular-nums">{fmtCurrency(r.harga_jual)}</td>
                  <td className="p-2 text-slate-600 uppercase text-[10px]">{formatDate(r.last_log)}</td>
                  <td className="p-2 text-right tabular-nums font-semibold">{fmtCurrency(Number(r.harga_modal || 0) * Number(r.stok || 0))}</td>
                  <td className="p-2 text-right tabular-nums">{fmtCurrency(Number(r.harga_jual || 0) * Number(r.stok || 0))}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${Number(r.status ?? 1) === 1 ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-700'}`}>{Number(r.status ?? 1) === 1 ? 'Aktif' : 'Off'}</span>
                      <Button variant="ghost" size="xs" className="h-6 px-2 text-[10px] underline" onClick={() => updateStatus(r.jenis, r.id, Number(r.status ?? 1) === 1 ? 0 : 1)}>{Number(r.status ?? 1) === 1 ? 'Matikan' : 'Aktifkan'}</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td className="p-3 text-center text-slate-500" colSpan={11}>Tidak ada data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {(!isAll && showIdle) && (
        <div className="mt-4 overflow-x-auto border rounded shadow-sm">
          <div className="px-3 py-2 text-sm font-semibold bg-orange-50 text-orange-800 border-b">Hasil cek aset tidak berjalan: ≥ {months} bulan</div>
          <table className="min-w-full w-full text-sm">
            <thead className="bg-slate-100 font-semibold text-slate-700 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-2 text-left w-12">No</th>
                <th className="p-2 text-left">Jenis</th>
                <th className="p-2 text-left">Nama</th>
                <th className="p-2 text-left">SKU</th>
                <th className="p-2 text-right">Stok</th>
                <th className="p-2 text-right">Modal</th>
                <th className="p-2 text-right">Jual</th>
                <th className="p-2 text-left">Terakhir Jual</th>
                <th className="p-2 text-right">Nilai Aset</th>
                <th className="p-2 text-right">Usia (bln)</th>
                <th className="p-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {idleLoading ? (
                <TableBodySkeleton rows={10} cols={11} />
              ) : idleRows.map((r, idx) => (
                <tr key={idx} className="border-t hover:bg-orange-50/30 transition-colors">
                  <td className="p-2 text-slate-500 font-mono text-xs">{idx + 1}</td>
                  <td className="p-2">{r.jenis}</td>
                  <td className="p-2"><ProductTransactionDetailTrigger jenis={r.jenis} productId={r.id} cabangId={cabang}><span className="text-primary hover:underline cursor-pointer font-medium">{r.nama}</span></ProductTransactionDetailTrigger></td>
                  <td className="p-2 font-mono text-xs">{r.sku}</td>
                  <td className="p-2 text-right tabular-nums">{fmtCurrency(r.stok)}</td>
                  <td className="p-2 text-right tabular-nums">{fmtCurrency(r.harga_modal)}</td>
                  <td className="p-2 text-right tabular-nums">{fmtCurrency(r.harga_jual)}</td>
                  <td className="p-2 text-slate-600 uppercase text-[10px]">{formatDate(r.last_log)}</td>
                  <td className="p-2 text-right tabular-nums font-semibold">{fmtCurrency(Number(r.harga_modal || 0) * Number(r.stok || 0))}</td>
                  <td className="p-2 text-right tabular-nums text-red-600 font-bold">{fmtCurrency(r.months_since_log)}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${Number(r.status ?? 1) === 1 ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-700'}`}>{Number(r.status ?? 1) === 1 ? 'Aktif' : 'Off'}</span>
                      <Button variant="ghost" size="xs" className="h-6 px-2 text-[10px] underline" onClick={() => updateStatus(r.jenis, r.id, Number(r.status ?? 1) === 1 ? 0 : 1)}>{Number(r.status ?? 1) === 1 ? 'Matikan' : 'Aktifkan'}</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!idleLoading && idleRows.length === 0 && (
                <tr><td className="p-3 text-center text-slate-500" colSpan={11}>Tidak ada data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function fmtCurrency(n) { return Number(n || 0).toLocaleString('id-ID') }
function formatDate(s) { if (!s) return ''; if (typeof s === 'string') return s.slice(0, 10); try { return new Date(s).toLocaleDateString('id-ID') } catch { return String(s) } }
