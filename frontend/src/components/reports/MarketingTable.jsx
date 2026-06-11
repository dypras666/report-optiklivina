import React from 'react'
import CustomerDetailTrigger from '@/components/customer/CustomerDetailTrigger.jsx'
import { Button } from '@/components/ui/button'
import { tableClass, theadClass } from '@/components/ui/tableStyles.js'
import { TableBodySkeleton } from '@/components/ui/TableSkeleton.jsx'
import MarketingTransactionDetailTrigger from '@/components/marketing/MarketingTransactionDetailTrigger.jsx'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://reportsapi.optiklivina.com'

function fmtCurrency(n) {
  return Number(n || 0).toLocaleString('id-ID')
}

function formatDate(s) {
  if (!s) return ''
  if (typeof s === 'string') return s.slice(0, 10)
  try { return new Date(s).toLocaleDateString('id-ID') } catch { return String(s) }
}

function RowDetail({ kode, openRows, setOpenRows, itemsMap, setItemsMap }) {
  const open = !!openRows[kode]
  const [loading, setLoading] = React.useState(false)
  const toggle = async () => {
    if (!open && !itemsMap[kode]) {
      setLoading(true)
      const res = await fetch(`${API_BASE}/api/reports/marketing/${kode}/items`)
      const json = await res.json()
      setItemsMap(m => ({ ...m, [kode]: json.data || [] }))
      setLoading(false)
    }
    setOpenRows(m => ({ ...m, [kode]: !open }))
  }
  return <Button onClick={toggle} disabled={loading}>{loading ? 'Memuat...' : (open ? 'Tutup' : 'Detail')}</Button>
}

function DetailRow({ kode, openRows, itemsMap, loading }) {
  const open = !!openRows[kode]
  const items = itemsMap[kode] || []
  if (!open) return null
  return (
    <tr className="bg-slate-50">
      <td className="p-2" colSpan={13}>
        <table className="min-w-full w-full text-xs">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-2 text-left">Produk</th>
              <th className="p-2 text-left">Jenis</th>
              <th className="p-2 text-right">Qty</th>
              <th className="p-2 text-right">Harga</th>
              <th className="p-2 text-right">Modal Unit</th>
              <th className="p-2 text-right">Jumlah</th>
              <th className="p-2 text-right">Modal Total</th>
              <th className="p-2 text-right">Ongkir Unit</th>
              <th className="p-2 text-right">Ongkir Total</th>
              <th className="p-2 text-right">Laba Item</th>
              <th className="p-2 text-left">Tanggal</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableBodySkeleton rows={6} cols={11} />
            ) : items.map((it, idx) => (
              <tr key={`${kode}-${idx}`} className="border-t">
                <td className="p-2">{it.nama_produk || `${it.jenis_produk} #${it.id_produk}`}</td>
                <td className="p-2">{it.jenis_produk}</td>
                <td className="p-2 text-right">{it.jumlah}</td>
                <td className="p-2 text-right">{fmtCurrency(it.harga_produk)}</td>
                <td className="p-2 text-right">{fmtCurrency(it.harga_modal)}</td>
                <td className="p-2 text-right">{fmtCurrency(it.jumlah_harga)}</td>
                <td className="p-2 text-right">{fmtCurrency(it.jumlah_modal)}</td>
                <td className="p-2 text-right">{fmtCurrency(it.harga_ongkir)}</td>
                <td className="p-2 text-right">{fmtCurrency(it.jumlah_ongkir)}</td>
                <td className="p-2 text-right">{fmtCurrency(it.laba_item)}</td>
                <td className="p-2 text-left">{formatDate(it.tanggal_log)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </td>
    </tr>
  )
}

export default function MarketingTable({ rows = [], totals, openRows, setOpenRows, itemsMap, setItemsMap, loading = false }) {
  return (
    <table className={tableClass}>
      <thead className={theadClass}>
        <tr>
          <th className="p-2 text-left">Tanggal</th>
          <th className="p-2 text-left">Kode</th>
          <th className="p-2 text-left">Cabang</th>
          <th className="p-2 text-left">Marketing</th>
          <th className="p-2 text-left">Customer</th>
          <th className="p-2 text-right">Fix Harga</th>
          <th className="p-2 text-right">Ongkir</th>
          <th className="p-2 text-right">Jml Bayar</th>
          <th className="p-2 text-right">Sisa Bayar</th>
          <th className="p-2 text-right">Laba Item</th>
          <th className="p-2 text-right">Estimasi Laba (Belum Lunas)</th>
          <th className="p-2 text-right">Laba Klik Bayar (Sudah Lunas)</th>
          <th className="p-2 text-left">Jenis Bayar</th>
          <th className="p-2 text-left">Detail</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <TableBodySkeleton rows={10} cols={14} />
        ) : rows.map(r => (
          <React.Fragment key={r.id_transaksi}>
            <tr className="border-t">
              <td className="p-2">{formatDate(r.tanggal_order)}</td>
              <td className="p-2"><MarketingTransactionDetailTrigger kodeTransaksi={r.kode_transaksi}>{r.kode_transaksi}</MarketingTransactionDetailTrigger></td>
              <td className="p-2">{r.nama_cabang}</td>
              <td className="p-2">{r.nama_lengkap}</td>
              <td className="p-2"><CustomerDetailTrigger name={r.nama_customer} kodeTransaksi={r.kode_transaksi} status={r.status_user}><span className="text-primary underline mr-2">{r.kode_customer || ''}</span> {r.nama_customer}</CustomerDetailTrigger></td>
              <td className="p-2 text-right">{fmtCurrency(r.fix_harga)}</td>
              <td className="p-2 text-right">{fmtCurrency(r.ongkir_items)}</td>
              <td className="p-2 text-right">{fmtCurrency(r.jml_bayar)}</td>
              <td className="p-2 text-right">{fmtCurrency(r.sisa_bayar)}</td>
              <td className="p-2 text-right">{fmtCurrency(r.laba_items)}</td>
              <td className="p-2 text-right">{fmtCurrency((Number(r.sisa_bayar || 0) > 0 ? Number(r.laba_items || 0) : 0))}</td>
              <td className="p-2 text-right">{fmtCurrency((Number(r.sisa_bayar || 0) <= 0 ? Number(r.laba_items || 0) : 0))}</td>
              <td className="p-2">{r.jenis_transaksi_bayar || ''}</td>
              <td className="p-2"><RowDetail kode={r.kode_transaksi} openRows={openRows} setOpenRows={setOpenRows} itemsMap={itemsMap} setItemsMap={setItemsMap} /></td>
            </tr>
            <DetailRow kode={r.kode_transaksi} openRows={openRows} itemsMap={itemsMap} loading={!!openRows[r.kode_transaksi] && !itemsMap[r.kode_transaksi]} />
          </React.Fragment>
        ))}
        {!loading && rows.length === 0 && (
          <tr><td className="p-3" colSpan={14}>Tidak ada data</td></tr>
        )}
      </tbody>
      <tfoot className="bg-slate-100">
        <tr>
          <td className="p-2 font-semibold" colSpan={5}>Total</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(totals.fix)}</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(totals.ongkir)}</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(totals.bayar)}</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(totals.sisa)}</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(totals.laba)}</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(totals.laba_est)}</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(totals.laba_paid)}</td>
          <td className="p-2" colSpan={2}></td>
        </tr>
      </tfoot>
    </table>
  )
}
