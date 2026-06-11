import React from 'react'
import CustomerDetailTrigger from '@/components/customer/CustomerDetailTrigger.jsx'
import CustomerUnpaidTrigger from '@/components/customer/CustomerUnpaidTrigger.jsx'
import Pagination from '@/components/ui/Pagination.jsx'
import { TableBodySkeleton } from '@/components/ui/TableSkeleton.jsx'
import { tableClass, theadClass, containerClass } from '@/components/ui/tableStyles.js'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Combobox } from '@/components/ui/combobox'

import { API_BASE } from '../config.js'

export default function Customers() {
  const [rows, setRows] = React.useState([])
  const [loading, setLoading] = React.useState(false)
  const [meta, setMeta] = React.useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [stats, setStats] = React.useState({ total: 0, blacklist: 0, complete: 0, unpaid: 0, lunas: 0 })
  const [filters, setFilters] = React.useState({ cabang: '', marketing: '', doc: '', aging: '', q: '', addr: '', status: '', unpaid: '' })
  const [showFilters, setShowFilters] = React.useState(true)
  const [marketingOpts, setMarketingOpts] = React.useState([])
  const [cabangOpts, setCabangOpts] = React.useState([])

  // Dialog state
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [dialogConfig, setDialogConfig] = React.useState({ title: '', desc: '', kode: '', status: '', type: '' })
  const [blacklistReason, setBlacklistReason] = React.useState('')
  const [customReason, setCustomReason] = React.useState('')
  const [previewImage, setPreviewImage] = React.useState({ url: '', title: '', open: false })

  const prevFiltersRef = React.useRef(filters)

  React.useEffect(() => {
    initOptions()
  }, [])

  React.useEffect(() => {
    // Check if filters changed (excluding page/limit)
    const currentFiltersStr = JSON.stringify(filters)
    const prevFiltersStr = JSON.stringify(prevFiltersRef.current)
    const filtersChanged = currentFiltersStr !== prevFiltersStr
    
    if (filtersChanged) {
      prevFiltersRef.current = filters
      if (meta.page !== 1) {
        setMeta(m => ({ ...m, page: 1 }))
        // Wait for the next effect run triggered by meta.page change
        return
      }
    }
    
    fetchData()
  }, [filters, meta.page, meta.limit])

  async function initOptions() {
    const [mRes, cRes] = await Promise.all([
      fetch(`${API_BASE}/api/options/marketing`),
      fetch(`${API_BASE}/api/options/cabang`)
    ])
    const mJson = await mRes.json()
    const cJson = await cRes.json()
    setMarketingOpts(mJson.data || [])
    setCabangOpts(cJson.data || [])
  }

  async function fetchData() {
    setLoading(true)
    const p = new URLSearchParams()
    if (filters.cabang) p.set('cabang', filters.cabang)
    if (filters.marketing) p.set('marketing', filters.marketing)
    if (filters.doc) p.set('doc', filters.doc)
    if (filters.aging) p.set('aging', filters.aging)
    if (filters.status) p.set('status', filters.status)
    if (filters.unpaid) p.set('unpaid', filters.unpaid)
    if (filters.q) p.set('q', filters.q)
    if (filters.addr) p.set('addr', filters.addr)
    if (meta.page) p.set('page', meta.page)
    if (meta.limit) p.set('limit', meta.limit)
    try {
      const res = await fetch(`${API_BASE}/api/reports/customers?${p.toString()}`)
      const json = await res.json()
      setRows(json.data || [])
      setMeta(json.meta || { page: 1, limit: 20, total: 0, totalPages: 0 })
      if (json.stats) setStats(json.stats)
    } catch (e) {
    } finally { setLoading(false) }
  }

  async function handlePreviewImage(url, title) {
    if (!url) return
    try {
      // Revoke old blob URL if exists
      if (previewImage.url && previewImage.url.startsWith('blob:')) {
        URL.revokeObjectURL(previewImage.url)
      }

      const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`
      const res = await fetch(fullUrl)
      if (!res.ok) throw new Error('Gagal mengambil gambar')
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      setPreviewImage({ url: blobUrl, title, open: true })
    } catch (e) {
      console.error(e)
      alert('Gagal memuat gambar: ' + e.message)
    }
  }

  // Cleanup blob URL on unmount
  React.useEffect(() => {
    return () => {
      if (previewImage.url && previewImage.url.startsWith('blob:')) {
        URL.revokeObjectURL(previewImage.url)
      }
    }
  }, [])

  async function uploadDocs(kode, files) {
    const fd = new FormData()
    if (files.ktp) fd.append('ktp', files.ktp)
    if (files.kk) fd.append('kk', files.kk)
    const res = await fetch(`${API_BASE}/api/reports/customer/${kode}/upload-docs`, { method: 'POST', body: fd })
    const json = await res.json()
    if (json.ok) { fetchData() }
  }

  function confirmToggleStatus(kode, status) {
    if (status === 'blacklist') {
      setBlacklistReason('')
      setCustomReason('')
      setDialogConfig({
        title: 'Set Blacklist',
        desc: `Pilih alasan kenapa customer ${kode} diblacklist:`,
        kode,
        status,
        type: 'blacklist_confirm'
      })
    } else {
      setDialogConfig({
        title: 'Hapus Blacklist',
        desc: `Apakah Anda yakin ingin mengubah status customer ${kode} menjadi normal?`,
        kode,
        status,
        type: 'confirm'
      })
    }
    setDialogOpen(true)
  }

  async function performToggleStatus(kode, status, reason) {
    try {
      const body = { status }
      if (status === 'blacklist') {
        body.reason = reason === 'Lainnya' ? customReason : reason
      }
      const res = await fetch(`${API_BASE}/api/reports/customer/${kode}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const json = await res.json()
      if (json.status !== undefined) {
        fetchData()
      } else {
        console.error('Gagal mengubah status', json)
      }
    } catch (e) {
      console.error(e)
    }
    setDialogOpen(false)
  }

  function exportToExcel() {
    const p = new URLSearchParams()
    if (filters.cabang) p.set('cabang', filters.cabang)
    if (filters.marketing) p.set('marketing', filters.marketing)
    if (filters.doc) p.set('doc', filters.doc)
    if (filters.aging) p.set('aging', filters.aging)
    if (filters.status) p.set('status', filters.status)
    if (filters.unpaid) p.set('unpaid', filters.unpaid)
    if (filters.q) p.set('q', filters.q)
    if (filters.addr) p.set('addr', filters.addr)
    window.open(`${API_BASE}/api/reports/customers/export?${p.toString()}`, '_blank')
  }

  return (
    <div className="">
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogConfig.title}</DialogTitle>
            <DialogDescription>{dialogConfig.desc}</DialogDescription>
          </DialogHeader>

          {dialogConfig.type === 'blacklist_confirm' && (
            <div className="space-y-3 py-2">
              <select
                className="w-full border rounded p-2"
                value={blacklistReason}
                onChange={e => setBlacklistReason(e.target.value)}
              >
                <option value="">-- Pilih Alasan --</option>
                <option value="Kredit Macet">Kredit Macet</option>
                <option value="Perilaku Tidak Baik">Perilaku Tidak Baik</option>
                <option value="Data Tidak Valid">Data Tidak Valid</option>
                <option value="Lainnya">Lainnya (Custom)</option>
              </select>
              {blacklistReason === 'Lainnya' && (
                <input
                  type="text"
                  className="w-full border rounded p-2"
                  placeholder="Ketik alasan custom..."
                  value={customReason}
                  onChange={e => setCustomReason(e.target.value)}
                />
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button
              disabled={dialogConfig.type === 'blacklist_confirm' && !blacklistReason}
              onClick={() => performToggleStatus(dialogConfig.kode, dialogConfig.status, blacklistReason)}
            >
              Konfirmasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      <Dialog open={previewImage.open} onOpenChange={(v) => {
        if (!v && previewImage.url && previewImage.url.startsWith('blob:')) {
          // We can't revoke immediately because the img might still be rendering during closing animation
          // but setPreviewImage will handle it next time a preview is opened or on unmount
        }
        setPreviewImage(s => ({ ...s, open: v }))
      }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewImage.title}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center p-4 bg-slate-100 rounded">
            {previewImage.url ? (
              <img src={previewImage.url} alt="Preview" className="max-h-[70vh] object-contain shadow-lg" />
            ) : (
              <div className="h-40 flex items-center justify-center text-muted-foreground italic">Memuat gambar...</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewImage(s => ({ ...s, open: false }))}>Tutup</Button>
            {previewImage.url && <Button onClick={() => window.open(previewImage.url, '_blank')}>Tab Baru</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <div className="flex justify-between items-center mb-2 px-1">
        <h1 className="text-2xl font-semibold">Data Customer</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToExcel}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            {showFilters ? 'Sembunyikan' : 'Tampilkan'} Filter
          </Button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-5 mb-4 px-1">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Belum Lunas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.unpaid}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lunas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.lunas}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blacklisted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.blacklist}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dokumen Lengkap</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.complete}</div>
          </CardContent>
        </Card>
      </div>

      {showFilters && (
        <div className="bg-muted/30 rounded-lg p-4 mb-3 mx-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Cabang</label>
              <select className="border rounded px-2 py-1 w-full" value={filters.cabang} onChange={e => setFilters(f => ({ ...f, cabang: e.target.value, marketing: '' }))}>
                <option value="">Semua Cabang</option>
                {cabangOpts.map(c => (<option key={c.value} value={c.value}>{c.label}</option>))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Marketing</label>
              <Combobox
                options={marketingOpts}
                value={filters.marketing}
                onChange={v => setFilters(f => ({ ...f, marketing: v }))}
                placeholder="Semua Marketing"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Status User</label>
              <select className="border rounded px-2 py-1 w-full" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
                <option value="">Semua Status</option>
                <option value="normal">Normal</option>
                <option value="blacklist">Blacklist</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Dokumen</label>
              <select className="border rounded px-2 py-1 w-full" value={filters.doc} onChange={e => setFilters(f => ({ ...f, doc: e.target.value }))}>
                <option value="">Semua Dokumen</option>
                <option value="ktp">KTP saja</option>
                <option value="kk">KK saja</option>
                <option value="lengkap">KTP + KK lengkap</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Aging</label>
              <select className="border rounded px-2 py-1 w-full" value={filters.aging} onChange={e => setFilters(f => ({ ...f, aging: e.target.value }))}>
                <option value="">Semua Data</option>
                <option value="gt3">&gt; 3 bulan</option>
                <option value="6to12">6 bulan — 1 tahun</option>
                <option value="gt12">&gt; 1 tahun</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Status Pembayaran</label>
              <select className="border rounded px-2 py-1 w-full" value={filters.unpaid} onChange={e => setFilters(f => ({ ...f, unpaid: e.target.value }))}>
                <option value="">Semua</option>
                <option value="1">Belum Lunas</option>
                <option value="lunas">Lunas</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Limit</label>
              <select className="border rounded px-2 py-1 w-full" value={meta.limit} onChange={e => setMeta(m => ({ ...m, page: 1, limit: parseInt(e.target.value, 10) }))}>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Cari Nama / No HP / NIK</label>
              <input className="border rounded px-2 py-1 w-full" placeholder="Ketik nama, nomor HP, atau NIK..." value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value, page: 1 }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Cari Alamat</label>
              <input className="border rounded px-2 py-1 w-full" placeholder="Ketik alamat..." value={filters.addr} onChange={e => setFilters(f => ({ ...f, addr: e.target.value, page: 1 }))} />
            </div>
          </div>
        </div>
      )}

      {/* Desktop Table View */}
      <div className={`${containerClass} hidden md:block`}>
        <table className={tableClass}>
          <thead className={theadClass}>
            <tr>
              <th className="px-4 py-3 text-left border-b font-medium text-muted-foreground w-12">No</th>
              <th className="px-4 py-3 text-left border-b font-medium text-muted-foreground">Customer</th>
              <th className="px-4 py-3 text-left border-b font-medium text-muted-foreground">HP</th>
              <th className="px-4 py-3 text-left border-b font-medium text-muted-foreground">Cabang</th>
              <th className="px-4 py-3 text-left border-b font-medium text-muted-foreground">Marketing</th>
              <th className="px-4 py-3 text-left border-b font-medium text-muted-foreground w-24">Status</th>
              <th className="px-4 py-3 text-left border-b font-medium text-muted-foreground">Keterangan</th>
              <th className="px-4 py-3 text-left border-b font-medium text-muted-foreground">Dokumen</th>
              <th className="px-4 py-3 text-right border-b font-medium text-muted-foreground">Sisa Bayar</th>
              <th className="px-4 py-3 text-left border-b font-medium text-muted-foreground">Aging</th>
              <th className="px-4 py-3 text-left border-b font-medium text-muted-foreground">Register</th>
              <th className="px-4 py-3 text-left border-b font-medium text-muted-foreground">Upload</th>
              <th className="px-4 py-3 text-left border-b font-medium text-muted-foreground">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableBodySkeleton rows={10} cols={13} />
            ) : (
              <>
                {rows.map((r, idx) => (
                  <CustomerRow key={idx} r={r} idx={((meta.page - 1) * meta.limit) + idx + 1} onUpload={uploadDocs} onToggleStatus={confirmToggleStatus} onPreviewImage={handlePreviewImage} />
                ))}
                {rows.length === 0 && (
                  <tr><td className="p-4 text-center text-muted-foreground" colSpan={13}>Tidak ada data</td></tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden px-1">
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg border p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {rows.map((r, idx) => (
              <CustomerCard key={idx} r={r} idx={((meta.page - 1) * meta.limit) + idx + 1} onUpload={uploadDocs} onToggleStatus={confirmToggleStatus} onPreviewImage={handlePreviewImage} />
            ))}
            {rows.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">Tidak ada data</div>
            )}
          </>
        )}
      </div>

      <Pagination
        className="mt-3 px-1"
        page={meta.page}
        totalPages={meta.totalPages}
        total={meta.total}
        disabledPrev={meta.page <= 1 || loading}
        disabledNext={meta.page >= meta.totalPages || loading}
        onPrev={() => setMeta(m => ({ ...m, page: Math.max(1, m.page - 1) }))}
        onNext={() => setMeta(m => ({ ...m, page: Math.min(m.totalPages, m.page + 1) }))}
        onJump={(p) => setMeta(m => ({ ...m, page: p }))}
      />
    </div >
  )
}

function CustomerCard({ r, idx, onUpload, onToggleStatus, onPreviewImage }) {
  const [ktp, setKtp] = React.useState(null)
  const [kk, setKk] = React.useState(null)
  const kode = r.kode_customer || ''
  const agingText = r.sisa_total > 0 ? `${r.aging_months} bln` : '-'

  const cardClass = r.status_user === 'blacklist' ? 'bg-red-50 border-red-200' : 'bg-white'

  return (
    <div className={`${cardClass} rounded-lg border p-4 mb-3 shadow-sm`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground">#{idx}</span>
            {r.status_user === 'blacklist' && (
              <div className="flex flex-col gap-0.5">
                <span className="inline-flex items-center rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                  Blacklist
                </span>
                {r.blacklist_reason && (
                  <span className="text-[10px] text-red-600 font-medium italic">"{r.blacklist_reason}"</span>
                )}
                {r.last_payment_type && (
                  <span className="text-[10px] text-red-600 italic">{r.last_payment_type}</span>
                )}
              </div>
            )}
          </div>
          <CustomerDetailTrigger kodeCustomer={kode}>
            <h3 className="font-semibold text-lg text-primary hover:underline cursor-pointer">
              {r.nama_customer || kode}
            </h3>
          </CustomerDetailTrigger>
          <p className="text-sm text-muted-foreground">{r.no_hp || '-'}</p>
        </div>
        <div className="text-right">
          {r.sisa_total > 0 ? (
            <CustomerUnpaidTrigger kodeCustomer={kode}>
              <div className="cursor-pointer group">
                <span className="inline-flex items-center rounded-full border border-red-200 bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 group-hover:bg-red-200">
                  Belum Lunas
                </span>
                <div className="text-sm font-mono text-red-600 font-bold mt-1 group-hover:underline">{fmtCurrency(r.sisa_total)}</div>
              </div>
            </CustomerUnpaidTrigger>
          ) : (
            <span className="inline-flex items-center rounded-full border border-green-200 bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
              Lunas
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
        <div>
          <span className="text-muted-foreground">Cabang:</span>
          <div className="font-medium">{r.nama_cabang || '-'}</div>
        </div>
        <div>
          <span className="text-muted-foreground">Marketing:</span>
          <div className="font-medium">{r.nama_marketing || '-'}</div>
        </div>
        <div>
          <span className="text-muted-foreground">Aging:</span>
          <div className="font-medium">{agingText}</div>
        </div>
        <div>
          <span className="text-muted-foreground">Register:</span>
          <div className="font-medium">{formatDate(r.tanggal_register)}</div>
        </div>
      </div>

      <div className="mb-3">
        <span className="text-sm text-muted-foreground block mb-1">Dokumen:</span>
        <div className="flex gap-2">
          {r.file_ktp_url ? (
            <Button variant="outline" size="sm" className="h-8 text-xs flex gap-1" onClick={() => onPreviewImage(r.file_ktp_url, `KTP - ${r.nama_customer || kode}`)}>
              <span>Lihat KTP</span>
            </Button>
          ) : <span className="text-xs text-muted-foreground opacity-50 italic">KTP (-)</span>}
          {r.file_kk_url ? (
            <Button variant="outline" size="sm" className="h-8 text-xs flex gap-1" onClick={() => onPreviewImage(r.file_kk_url, `KK - ${r.nama_customer || kode}`)}>
              <span>Lihat KK</span>
            </Button>
          ) : <span className="text-xs text-muted-foreground opacity-50 italic">KK (-)</span>}
        </div>
      </div>

      <div className="border-t pt-3">
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input type="file" accept="image/*" onChange={e => setKtp(e.target.files?.[0] || null)} className="flex-1 text-xs file:mr-1 file:py-1 file:px-2 file:border-0 file:text-xs file:bg-gray-100 rounded" placeholder="KTP" />
            <input type="file" accept="image/*" onChange={e => setKk(e.target.files?.[0] || null)} className="flex-1 text-xs file:mr-1 file:py-1 file:px-2 file:border-0 file:text-xs file:bg-gray-100 rounded" placeholder="KK" />
            <Button variant="ghost" size="sm" className="h-8 px-3 text-xs border" onClick={() => onUpload(kode, { ktp, kk })} disabled={!kode}>Upload</Button>
          </div>
          <div className="flex gap-2">
            <CustomerDetailTrigger kodeCustomer={kode} status={r.status_user}>
              <Button variant="outline" size="sm" className="flex-1 h-8 text-xs">Detail</Button>
            </CustomerDetailTrigger>
            {r.status_user === 'blacklist' ? (
              <Button variant="outline" size="sm" className="flex-1 h-8 text-xs bg-white text-gray-700 border-gray-300 hover:bg-gray-50" onClick={() => onToggleStatus(kode, 'normal')}>Hapus BL</Button>
            ) : (
              <Button variant="destructive" size="sm" className="flex-1 h-8 text-xs" onClick={() => onToggleStatus(kode, 'blacklist')}>Blacklist</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CustomerRow({ r, idx, onUpload, onToggleStatus, onPreviewImage }) {
  const [ktp, setKtp] = React.useState(null)
  const [kk, setKk] = React.useState(null)
  const kode = r.kode_customer || ''
  const agingText = r.sisa_total > 0 ? `${r.aging_months} bln` : '-'

  const rowClass = r.status_user === 'blacklist' ? 'bg-red-50 hover:bg-red-100/80 transition-colors' : 'hover:bg-muted/50 transition-colors'

  return (
    <tr className={`border-b ${rowClass}`}>
      <td className="px-4 py-2 text-slate-400 font-mono text-[10px]">{idx}</td>
      <td className="px-4 py-2 font-medium">
        <CustomerDetailTrigger kodeCustomer={kode} status={r.status_user}><span className="text-primary hover:underline cursor-pointer">{r.nama_customer || kode}</span></CustomerDetailTrigger>
      </td>
      <td className="px-4 py-2">{r.no_hp || '-'}</td>
      <td className="px-4 py-2">{r.nama_cabang || '-'}</td>
      <td className="px-4 py-2">{r.nama_marketing || '-'}</td>
      <td className="px-4 py-2">
        {r.status_user === 'blacklist' ? (
          <div className="flex flex-col gap-0.5">
            <span className="inline-flex items-center rounded-full border border-red-200 bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
              Blacklist
            </span>
            {r.blacklist_reason && (
              <span className="text-[10px] text-red-600 font-medium italic leading-tight">"{r.blacklist_reason}"</span>
            )}
            {r.last_payment_type && (
              <span className="text-[10px] text-red-600 italic">{r.last_payment_type}</span>
            )}
          </div>
        ) : (
          <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
            Normal
          </span>
        )}
      </td>
      <td className="px-4 py-2 text-sm text-red-600 italic">
        {r.status_user === 'blacklist' ? (r.blacklist_reason || '-') : '-'}
      </td>
      <td className="px-4 py-2 text-sm">
        <div className="flex gap-1">
          {r.file_ktp_url ? (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs border" onClick={() => onPreviewImage(r.file_ktp_url, `KTP - ${r.nama_customer || kode}`)}>Lihat KTP</Button>
          ) : <span className="text-xs text-muted-foreground opacity-50">No KTP</span>}
          {r.file_kk_url ? (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs border" onClick={() => onPreviewImage(r.file_kk_url, `KK - ${r.nama_customer || kode}`)}>Lihat KK</Button>
          ) : <span className="text-xs text-muted-foreground opacity-50">No KK</span>}
        </div>
      </td>
      <td className="px-4 py-2 text-right">
        {r.sisa_total > 0 ? (
          <CustomerUnpaidTrigger kodeCustomer={kode}>
            <div className="flex flex-col items-end cursor-pointer group">
              <span className="inline-flex items-center rounded-full border border-red-200 bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 group-hover:bg-red-200">
                Belum Lunas
              </span>
              <span className="text-xs font-mono text-red-600 font-bold group-hover:underline">{fmtCurrency(r.sisa_total)}</span>
            </div>
          </CustomerUnpaidTrigger>
        ) : (
          <span className="inline-flex items-center rounded-full border border-green-200 bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
            Lunas
          </span>
        )}
      </td>
      <td className="px-4 py-2 text-sm">{agingText}</td>
      <td className="px-4 py-2 text-sm">{formatDate(r.tanggal_register)}</td>
      <td className="px-4 py-2">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
          <input type="file" accept="image/*" onChange={e => setKtp(e.target.files?.[0] || null)} className="w-20 text-[10px] file:mr-1 file:py-0.5 file:px-1 file:border-0 file:text-[10px] file:bg-gray-100 rounded" />
          <input type="file" accept="image/*" onChange={e => setKk(e.target.files?.[0] || null)} className="w-20 text-[10px] file:mr-1 file:py-0.5 file:px-1 file:border-0 file:text-[10px] file:bg-gray-100 rounded" />
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs border" onClick={() => onUpload(kode, { ktp, kk })} disabled={!kode}>Up</Button>
        </div>
      </td>
      <td className="px-4 py-2">
        <div className="flex gap-2">
          <CustomerDetailTrigger kodeCustomer={kode}>
            <Button variant="outline" size="sm" className="h-7 text-xs">Detail</Button>
          </CustomerDetailTrigger>
          {r.status_user === 'blacklist' ? (
            <Button variant="outline" size="sm" className="h-7 text-xs bg-white text-gray-700 border-gray-300 hover:bg-gray-50" onClick={() => onToggleStatus(kode, 'normal')}>Hapus BL</Button>
          ) : (
            <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => onToggleStatus(kode, 'blacklist')}>Blacklist</Button>
          )}
        </div>
      </td>
    </tr>
  )
}

function fmtCurrency(n) { return Number(n || 0).toLocaleString('id-ID') }
function formatDate(s) { if (!s) return ''; if (typeof s === 'string') return s.slice(0, 10); try { return new Date(s).toLocaleDateString('id-ID') } catch { return String(s) } }
