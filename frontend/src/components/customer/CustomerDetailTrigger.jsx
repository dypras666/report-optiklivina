import React from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { TableBodySkeleton } from '@/components/ui/TableSkeleton.jsx'

import { API_BASE } from '../../config.js'

import TransactionItemsDialog from '@/components/transaction/TransactionItemsDialog.jsx'

export default function CustomerDetailTrigger({ name, kodeTransaksi, kodeCustomer, status, children }) {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [profile, setProfile] = React.useState(null)
  const [summary, setSummary] = React.useState({ transactions: [], points: { total_marketing: 0, total_used: 0 }, points_used_list: [], payments: [], warranty_claims: [] })
  const [tab, setTab] = React.useState('ringkas')
  const [selectedTrans, setSelectedTrans] = React.useState(null)

  const p = profile || {}
  const isBlacklist = status === 'blacklist' || p.status_user === 'blacklist'
  const triggerClass = isBlacklist ? 'text-red-600 font-medium' : ''

  async function openDetail() {
    setOpen(true)
    if (loading) return
    setLoading(true)
    try {
      let kodeCust = kodeCustomer
      if (!kodeCust && kodeTransaksi) {
        const resProf = await fetch(`${API_BASE}/api/reports/customer/profile/${kodeTransaksi}`)
        const jsonProf = await resProf.json()
        setProfile(jsonProf.data || null)
        kodeCust = jsonProf?.data?.kode_customer || ''
      }
      if (!profile && kodeCust && !kodeTransaksi) {
        const resProf = await fetch(`${API_BASE}/api/reports/customer/profile-by-code/${kodeCust}`)
        const jsonProf = await resProf.json()
        setProfile(jsonProf.data || null)
      }
      if (kodeCust) {
        const resSum = await fetch(`${API_BASE}/api/reports/customer/summary/${kodeCust}?limit=100`)
        const jsonSum = await resSum.json()
        setSummary({
          transactions: jsonSum.transactions || [],
          points: jsonSum.points || { total_marketing: 0, total_used: 0 },
          points_used_list: jsonSum.points_used_list || [],
          payments: jsonSum.payments || [],
          warranty_claims: jsonSum.warranty_claims || []
        })
        if (!profile) setProfile(jsonSum.profile || null)
      }
    } catch (e) {
    } finally {
      setLoading(false)
    }
  }

  const points = summary.points || { total_marketing: 0, total_used: 0 }
  const sumPayments = React.useMemo(() => (summary.payments || []).reduce((a, it) => a + Number(it.jumlah_bayar || 0), 0), [summary.payments])
  const paymentsGrouped = React.useMemo(() => {
    const byKode = {}
    const list = Array.isArray(summary.payments) ? summary.payments : []
    for (const pmt of list) {
      const k = pmt.kode || '-'
      if (!byKode[k]) byKode[k] = []
      byKode[k].push(pmt)
    }
    const groups = Object.keys(byKode).map(k => {
      const sorted = byKode[k].slice().sort((a, b) => String(a.tanggal_bayar).localeCompare(String(b.tanggal_bayar)))
      const total = sorted.reduce((a, it) => a + Number(it.jumlah_bayar || 0), 0)
      return { kode: k, rows: sorted, total }
    })
    groups.sort((a, b) => a.kode.localeCompare(b.kode))
    return groups
  }, [summary.payments])

  return (
    <>
      {children ? (
        <span onClick={openDetail} className={`cursor-pointer ${triggerClass}`}>{children}</span>
      ) : (
        <button className={`${isBlacklist ? 'text-red-600 font-medium' : 'text-primary'} underline`} onClick={openDetail}>{p.kode_customer || kodeCustomer || ''}</button>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-xl w-full">
          <div className="max-h-[80vh] overflow-y-auto pr-1">
            <SheetHeader>
              <SheetTitle>Detail Customer</SheetTitle>
            </SheetHeader>
            {loading ? (
              <div className="mt-3 space-y-2 text-xs sm:text-sm">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-2"><div className="w-32 sm:w-40 text-slate-600"><Skeleton className="h-4 w-24" /></div><div className="flex-1"><Skeleton className="h-4 w-full" /></div></div>
                ))}
              </div>
            ) : (
              <div className="mt-3 space-y-2 text-xs sm:text-sm">
                <div className={p.status_user === 'blacklist' ? 'text-red-600 font-medium' : ''}>
                  <Row label="Nama" value={p.nama_customer} />
                  <Row label="Kode" value={p.kode_customer} />
                  <Row label="QR" value={p.kode_qr} />
                  <Row label="No HP" value={p.no_hp} />
                  <Row label="Jenis Kelamin" value={p.jk} />
                  <Row label="NIK KTP" value={p.no_ktp} />
                  <Row label="No KK" value={p.no_kk} />
                  <Row label="Tempat Lahir" value={p.tempat_lahir} />
                  <Row label="Tanggal Lahir" value={p.tanggal_lahir} />
                  <Row label="Alamat" value={p.alamat_lengkap} />
                  <Row label="Kabupaten" value={p.kabupaten} />
                  <Row label="Kecamatan" value={p.kecamatan} />
                  <Row label="Desa" value={p.desa} />
                  <Row label="Cabang" value={p.nama_cabang} />
                  <Row label="Marketing" value={p.nama_marketing} />
                  {p.status_user === 'blacklist' && (
                    <Row label="STATUS" value={<span className="bg-red-600 text-white px-2 py-0.5 rounded text-[10px]">BLACKLIST</span>} />
                  )}
                  {p.blacklist_reason && (
                    <Row label="Alasan Blacklist" value={<span className="italic">"{p.blacklist_reason}"</span>} />
                  )}
                </div>
                <Row label="Dokumen KTP" value={p.file_ktp_url ? (<a href={p.file_ktp_url} target="_blank" rel="noreferrer" className="text-primary underline">Lihat</a>) : ''} />
                <Row label="Dokumen KK" value={p.file_kk_url ? (<a href={p.file_kk_url} target="_blank" rel="noreferrer" className="text-primary underline">Lihat</a>) : ''} />
              </div>
            )}

            {!loading && (
              <div className="mt-4">
                <div className="mb-2 flex gap-2 text-sm">
                  <button className={`px-3 py-1 border rounded ${tab === 'ringkas' ? 'bg-slate-100' : ''}`} onClick={() => setTab('ringkas')}>Ringkasan</button>
                  <button className={`px-3 py-1 border rounded ${tab === 'pembayaran' ? 'bg-slate-100' : ''}`} onClick={() => setTab('pembayaran')}>Pembayaran</button>
                  <button className={`px-3 py-1 border rounded ${tab === 'garansi' ? 'bg-slate-100' : ''}`} onClick={() => setTab('garansi')}>Garansi</button>
                </div>
              </div>
            )}

            {loading && (
              <div className="mt-4">
                <div className="font-semibold mb-2"><Skeleton className="h-4 w-32" /></div>
                <div className="overflow-auto border rounded">
                  <table className="w-full text-xs">
                    <tbody>
                      <TableBodySkeleton rows={6} cols={9} />
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!loading && tab === 'ringkas' && (
              <>
                <div className="mt-2">
                  <div className="font-semibold mb-2">Ringkasan Poin</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="p-2 border rounded">Total poin dapat: <b>{fmtCurrency(points.total_marketing)}</b></div>
                    <div className="p-2 border rounded">Poin digunakan: <b>{fmtCurrency(points.total_used)}</b></div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="font-semibold mb-2">Riwayat Transaksi</div>
                  <div className="overflow-auto border rounded">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="p-2 text-left">Kode</th>
                          <th className="p-2 text-left">Tipe</th>
                          <th className="p-2 text-left">Cabang</th>
                          <th className="p-2 text-left">Marketing</th>
                          <th className="p-2 text-right">Harga</th>
                          <th className="p-2 text-right">Bayar</th>
                          <th className="p-2 text-right">Sisa</th>
                          <th className="p-2 text-right">Poin</th>
                          <th className="p-2 text-left">Tanggal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.transactions.map((it, idx) => (
                          <tr key={idx} className="border-t hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedTrans(it.kode)}>
                            <td className="p-2 text-primary hover:underline">{it.kode}</td>
                            <td className="p-2">{it.tipe}</td>
                            <td className="p-2">{it.nama_cabang}</td>
                            <td className="p-2">{it.nama_marketing}</td>
                            <td className="p-2 text-right">{fmtCurrency(it.harga)}</td>
                            <td className="p-2 text-right">{fmtCurrency(it.j_bayar)}</td>
                            <td className="p-2 text-right">{fmtCurrency(it.sisa)}</td>
                            <td className="p-2 text-right">{fmtCurrency(it.poin)}</td>
                            <td className="p-2">{formatDate(it.tanggal)}</td>
                          </tr>
                        ))}
                        {summary.transactions.length === 0 && (
                          <tr><td className="p-3" colSpan={9}>Tidak ada transaksi</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="font-semibold mb-2">Poin Digunakan</div>
                  <div className="overflow-auto border rounded">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="p-2 text-left">Kode Transaksi</th>
                          <th className="p-2 text-right">Poin</th>
                          <th className="p-2 text-left">Tanggal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.points_used_list.map((it, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="p-2">{it.kode_transaksi}</td>
                            <td className="p-2 text-right">{fmtCurrency(it.point_use)}</td>
                            <td className="p-2">{formatDate(it.tanggal)}</td>
                          </tr>
                        ))}
                        {summary.points_used_list.length === 0 && (
                          <tr><td className="p-3" colSpan={3}>Tidak ada data penggunaan poin</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {!loading && tab === 'pembayaran' && (
              <div className="mt-2">
                <div className="font-semibold mb-2">Riwayat Pembayaran</div>
                <div className="max-h-[60vh] overflow-y-auto overflow-x-auto border rounded">
                  <table className="min-w-[600px] w-full text-xs">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="p-2 text-left">Kode</th>
                        <th className="p-2 text-left">Cabang</th>
                        <th className="p-2 text-left">Jenis</th>
                        <th className="p-2 text-right">Jumlah</th>
                        <th className="p-2 text-left">Tanggal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentsGrouped.map((grp, gidx) => (
                        <React.Fragment key={gidx}>
                          <tr className="border-t bg-slate-50">
                            <td className="p-2 font-semibold" colSpan={5}>Kode: {grp.kode} • Total: {fmtCurrency(grp.total)}</td>
                          </tr>
                          {grp.rows.map((it, idx) => (
                            <tr key={`${gidx}-${idx}`} className="border-t">
                              <td className="p-2 break-words">{it.kode}</td>
                              <td className="p-2">{it.nama_cabang}</td>
                              <td className="p-2">{it.jenis_transaksi || '-'}</td>
                              <td className="p-2 text-right">{fmtCurrency(it.jumlah_bayar)}</td>
                              <td className="p-2">{formatDate(it.tanggal_bayar)}</td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                      {paymentsGrouped.length === 0 && (
                        <tr><td className="p-3" colSpan={5}>Tidak ada pembayaran</td></tr>
                      )}
                    </tbody>
                    <tfoot className="bg-slate-100">
                      <tr>
                        <td className="p-2 font-semibold" colSpan={3}>Total</td>
                        <td className="p-2 text-right font-semibold">{fmtCurrency(sumPayments)}</td>
                        <td className="p-2"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {!loading && tab === 'garansi' && (
              <div className="mt-2">
                <div className="font-semibold mb-2">Klaim Garansi</div>
                <div className="overflow-auto border rounded">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="p-2 text-left">Kode</th>
                        <th className="p-2 text-left">Jenis Nota</th>
                        <th className="p-2 text-left">Cabang</th>
                        <th className="p-2 text-left">Jenis Produk</th>
                        <th className="p-2 text-right">Jumlah</th>
                        <th className="p-2 text-left">Tanggal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.warranty_claims.map((it, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2">{it.kode}</td>
                          <td className="p-2">{it.jenis_nota}</td>
                          <td className="p-2">{it.nama_cabang}</td>
                          <td className="p-2">{it.jenis_produk}</td>
                          <td className="p-2 text-right">{fmtCurrency(it.jumlah)}</td>
                          <td className="p-2">{formatDate(it.tanggal_log)}</td>
                        </tr>
                      ))}
                      {summary.warranty_claims.length === 0 && (
                        <tr><td className="p-3" colSpan={6}>Tidak ada klaim garansi</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <TransactionItemsDialog
        kodeTransaksi={selectedTrans}
        open={!!selectedTrans}
        onOpenChange={(v) => !v && setSelectedTrans(null)}
      />
    </>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-start gap-2"><div className="w-32 sm:w-40 text-slate-600">{label}</div><div className="flex-1 break-words">{value || '-'}</div></div>
  )
}

function fmtCurrency(n) { return Number(n || 0).toLocaleString('id-ID') }
function formatDate(s) { if (!s) return ''; if (typeof s === 'string') return s.slice(0, 10); try { return new Date(s).toLocaleDateString('id-ID') } catch { return String(s) } }
