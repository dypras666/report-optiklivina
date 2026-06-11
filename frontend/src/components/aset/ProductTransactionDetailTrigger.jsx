import React from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TableBodySkeleton } from '@/components/ui/TableSkeleton.jsx'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://reportsapi.optiklivina.com'

export default function ProductTransactionDetailTrigger({ jenis, productId, cabangId, children }){
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [items, setItems] = React.useState([])
  const [meta, setMeta] = React.useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [title, setTitle] = React.useState('')

  async function fetchPage(page = 1){
    setLoading(true)
    try{
      const p = new URLSearchParams()
      p.set('page', String(page))
      p.set('limit', String(meta.limit||20))
      if(cabangId) p.set('cabang', String(cabangId))
      p.set('all','1')
      const url = `${API_BASE}/api/aset/aset/product/${jenis}/${productId}/transactions?${p.toString()}`
      const res = await fetch(url)
      const json = await res.json()
      const incomingMeta = json.meta || { page: 1, limit: 20, total: 0, totalPages: 0 }
      const requestedPage = Number(incomingMeta.page || 1)
      const totalPages = Number(incomingMeta.totalPages || 0)
      const finalPage = (totalPages > 0 && requestedPage > totalPages) ? totalPages : requestedPage
      setItems(json.data || [])
      setMeta({ ...incomingMeta, page: finalPage })
      const hint = (json.data?.[0]?.nama_produk) || ''
      setTitle(hint || `${jenis} #${productId}`)
    }catch(e){ console.error(e) }finally{ setLoading(false) }
  }

  function openDetail(){ setOpen(true); setItems([]); setMeta(m=>({ ...m, page: 1 })); setTimeout(()=>fetchPage(1), 0) }

  return (
    <>
      <button className="text-primary underline" onClick={openDetail}>{children}</button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-xl w-full">
          <div className="max-h-[80vh] overflow-y-auto pr-1">
            <SheetHeader>
              <SheetTitle>Detail Transaksi Produk</SheetTitle>
            </SheetHeader>
            <div className="mt-3 space-y-2 text-xs sm:text-sm">
              {loading ? (
                <>
                  <div className="flex items-start gap-2"><div className="w-32 sm:w-40 text-slate-600"><Skeleton className="h-4 w-24" /></div><div className="flex-1"><Skeleton className="h-4 w-full" /></div></div>
                  <div className="flex items-start gap-2"><div className="w-32 sm:w-40 text-slate-600"><Skeleton className="h-4 w-24" /></div><div className="flex-1"><Skeleton className="h-4 w-full" /></div></div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2"><div className="w-32 sm:w-40 text-slate-600">Produk</div><div className="flex-1">{title}</div></div>
                  <div className="flex items-start gap-2"><div className="w-32 sm:w-40 text-slate-600">Cabang</div><div className="flex-1">{cabangId||'-'}</div></div>
                </>
              )}
            </div>

            <div className="mt-4">
              <div className="font-semibold mb-2">Transaksi Marketing</div>
              <div className="overflow-auto border rounded">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="p-2 text-left">Kode</th>
                      <th className="p-2 text-left">Customer</th>
                      <th className="p-2 text-left">Marketing</th>
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
                      <TableBodySkeleton rows={5} cols={12} />
                    ) : items.filter(it => !!it.nama_lengkap).map((it, idx) => (
                      <tr key={`mkt-${jenis}-${productId}-${idx}`} className="border-t">
                        <td className="p-2">{it.kode_transaksi}</td>
                        <td className="p-2">{it.nama_customer}</td>
                        <td className="p-2">{it.nama_lengkap}</td>
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
                    {!loading && items.filter(it => !!it.nama_lengkap).length===0 && (
                      <tr><td className="p-3" colSpan={12}>Tidak ada item</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="font-semibold mt-4 mb-2">Transaksi Toko</div>
              <div className="overflow-auto border rounded">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="p-2 text-left">Kode</th>
                      <th className="p-2 text-left">Customer</th>
                      <th className="p-2 text-left">Cabang</th>
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
                      <TableBodySkeleton rows={5} cols={12} />
                    ) : items.filter(it => !it.nama_lengkap).map((it, idx) => (
                      <tr key={`toko-${jenis}-${productId}-${idx}`} className="border-t">
                        <td className="p-2">{it.kode_transaksi}</td>
                        <td className="p-2">{it.nama_customer}</td>
                        <td className="p-2">{it.nama_cabang}</td>
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
                    {!loading && items.filter(it => !it.nama_lengkap).length===0 && (
                      <tr><td className="p-3" colSpan={12}>Tidak ada item</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-slate-600">Halaman {meta.page} dari {meta.totalPages} • Total {meta.total}</span>
                <div className="ml-auto flex items-center gap-2">
                  <Button className="border" disabled={meta.page<=1 || loading} onClick={()=>fetchPage(Math.max(1, meta.page-1))}>Prev</Button>
                  <Button className="border" disabled={meta.page>=meta.totalPages || loading} onClick={()=>fetchPage(Math.min(meta.totalPages, meta.page+1))}>Next</Button>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function fmtCurrency(n){
  return Number(n||0).toLocaleString('id-ID')
}

function formatDate(s){
  if(!s) return ''
  if(typeof s === 'string') return s.slice(0,10)
  try{ return new Date(s).toLocaleDateString('id-ID') }catch{ return String(s) }
}
