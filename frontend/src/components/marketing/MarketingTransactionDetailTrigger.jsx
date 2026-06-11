import React from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TableBodySkeleton } from '@/components/ui/TableSkeleton.jsx'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://reportsapi.optiklivina.com'

function fmtCurrency(n) { return Number(n || 0).toLocaleString('id-ID') }
function formatDate(s) { if (!s) return ''; if (typeof s === 'string') return s.slice(0, 10); try { return new Date(s).toLocaleDateString('id-ID') } catch { return String(s) } }

export default function MarketingTransactionDetailTrigger({ kodeTransaksi, children }) {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [header, setHeader] = React.useState(null)
  const [items, setItems] = React.useState([])

  async function openDetail() {
    if (!kodeTransaksi) return
    setOpen(true)
    if (loading) return
    setLoading(true)
    try {
      const [itemsRes, headerRes] = await Promise.all([
        fetch(`${API_BASE}/api/reports/marketing/${kodeTransaksi}/items`),
        fetch(`${API_BASE}/api/marketing/marketing/transaction/${kodeTransaksi}`)
      ])
      const itemsJson = await itemsRes.json()
      const headerJson = await headerRes.json()
      setItems(itemsJson.data || [])
      setHeader(headerJson.data || null)
    } catch (e) {
      setItems([])
      setHeader(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button className="text-primary underline" onClick={openDetail}>{children || kodeTransaksi}</button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-xl w-full p-0">
          <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between">
            <SheetTitle className="text-base md:text-lg">Detail Transaksi Marketing</SheetTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setOpen(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </Button>
          </div>
          <div className="max-h-[calc(100vh-60px)] overflow-y-auto px-4 py-3">
            <div className="space-y-2 text-xs sm:text-sm">
              {loading ? (
                <>
                  <div className="flex items-start gap-2"><div className="w-32 sm:w-40 text-slate-600"><Skeleton className="h-4 w-24" /></div><div className="flex-1"><Skeleton className="h-4 w-full" /></div></div>
                  <div className="flex items-start gap-2"><div className="w-32 sm:w-40 text-slate-600"><Skeleton className="h-4 w-24" /></div><div className="flex-1"><Skeleton className="h-4 w-full" /></div></div>
                  <div className="flex items-start gap-2"><div className="w-32 sm:w-40 text-slate-600"><Skeleton className="h-4 w-24" /></div><div className="flex-1"><Skeleton className="h-4 w-full" /></div></div>
                  <div className="flex items-start gap-2"><div className="w-32 sm:w-40 text-slate-600"><Skeleton className="h-4 w-24" /></div><div className="flex-1"><Skeleton className="h-4 w-full" /></div></div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2"><div className="w-32 sm:w-40 text-slate-600">Kode</div><div className="flex-1">{kodeTransaksi}</div></div>
                  <div className="flex items-start gap-2"><div className="w-32 sm:w-40 text-slate-600">Customer</div><div className="flex-1">{header?.nama_customer || '-'}</div></div>
                  <div className="flex items-start gap-2"><div className="w-32 sm:w-40 text-slate-600">Cabang</div><div className="flex-1">{header?.nama_cabang || '-'}</div></div>
                  <div className="flex items-start gap-2"><div className="w-32 sm:w-40 text-slate-600">Marketing</div><div className="flex-1">{header?.nama_marketing || '-'}</div></div>
                  <div className="flex items-start gap-2"><div className="w-32 sm:w-40 text-slate-600">Tanggal</div><div className="flex-1">{formatDate(header?.tanggal_order) || '-'}</div></div>
                  <div className="flex items-start gap-2"><div className="w-32 sm:w-40 text-slate-600">Fix Harga</div><div className="flex-1">{fmtCurrency(header?.fix_harga)}</div></div>
                  <div className="flex items-start gap-2"><div className="w-32 sm:w-40 text-slate-600">Bayar</div><div className="flex-1">{fmtCurrency(header?.jml_bayar)}</div></div>
                  <div className="flex items-start gap-2"><div className="w-32 sm:w-40 text-slate-600">Sisa</div><div className="flex-1">{fmtCurrency(header?.sisa_bayar)}</div></div>
                </>
              )}
            </div>

            <div className="mt-4">
              <div className="font-semibold mb-2">Item Transaksi</div>
              <div className="overflow-auto border rounded">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="p-2 text-left">Produk</th>
                      <th className="p-2 text-left">Jenis</th>
                      <th className="p-2 text-right">Qty</th>
                      <th className="p-2 text-right">Harga Unit</th>
                      <th className="p-2 text-right">Harga Jual</th>
                      <th className="p-2 text-right">Modal Unit</th>
                      <th className="p-2 text-right">Modal Total</th>
                      <th className="p-2 text-right">Ongkir Unit</th>
                      <th className="p-2 text-right">Ongkir Total</th>
                      <th className="p-2 text-right">Laba Item</th>
                      <th className="p-2 text-left">Tanggal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <TableBodySkeleton rows={8} cols={11} />
                    ) : items.map((it, idx) => (
                      <tr key={`${kodeTransaksi}-${idx}`} className="border-t">
                        <td className="p-2">{it.nama_produk || `${it.jenis_produk} #${it.id_produk}`}</td>
                        <td className="p-2">{it.jenis_produk}</td>
                        <td className="p-2 text-right">{fmtCurrency(it.jumlah)}</td>
                        <td className="p-2 text-right">{fmtCurrency(it.harga_produk)}</td>
                        <td className="p-2 text-right">{fmtCurrency(it.jumlah_harga)}</td>
                        <td className="p-2 text-right">{fmtCurrency(it.harga_modal)}</td>
                        <td className="p-2 text-right">{fmtCurrency(it.jumlah_modal)}</td>
                        <td className="p-2 text-right">{fmtCurrency(it.harga_ongkir)}</td>
                        <td className="p-2 text-right">{fmtCurrency(it.jumlah_ongkir)}</td>
                        <td className="p-2 text-right">{fmtCurrency(it.laba_item)}</td>
                        <td className="p-2">{formatDate(it.tanggal_log)}</td>
                      </tr>
                    ))}
                    {!loading && items.length === 0 && (
                      <tr><td className="p-3" colSpan={11}>Tidak ada item</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
