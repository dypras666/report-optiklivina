import React from 'react'
import CustomerDetailTrigger from '@/components/customer/CustomerDetailTrigger.jsx'
import { Button } from '@/components/ui/button'
import { tableClass, theadClass } from '@/components/ui/tableStyles.js'
import { TableBodySkeleton } from '@/components/ui/TableSkeleton.jsx'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://reportsapi.optiklivina.com'

function fmtCurrency(n) {
  return Number(n || 0).toLocaleString('id-ID')
}

function RowDetailOmsetPeriod({ cabangId, pembukuanId, openRows, setOpenRows, itemsMap, setItemsMap }) {
  const key = `period-${cabangId}-${pembukuanId}`
  const open = !!openRows[key]
  const [loading, setLoading] = React.useState(false)
  const toggle = async () => {
    if (!pembukuanId) return
    if (!open && !itemsMap[key]) {
      setLoading(true)
      const url = `${API_BASE}/api/omset/toko/items?cabang=${cabangId}&pembukuan_id=${pembukuanId}`
      const res = await fetch(url)
      const json = await res.json()
      setItemsMap(m => ({ ...m, [key]: json.data || [] }))
      setLoading(false)
    }
    setOpenRows(m => ({ ...m, [key]: !open }))
  }
  return <Button onClick={toggle} disabled={loading || !pembukuanId}>{loading ? 'Memuat...' : (!pembukuanId ? 'Pilih pembukuan' : (open ? 'Tutup' : 'Detail'))}</Button>
}

function DetailRowOmsetPeriod({ keyRow, openRows, itemsMap, loading }) {
  const open = !!openRows[keyRow]
  const items = itemsMap[keyRow] || []
  if (!open) return null
  return (
    <tr className="bg-slate-50">
      <td className="p-2" colSpan={13}>
        <table className="min-w-full w-full text-xs">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-2 text-left">Transaksi</th>
              <th className="p-2 text-left">Customer</th>
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
              <TableBodySkeleton rows={6} cols={13} />
            ) : items.map((it, idx) => (
              <tr key={`${keyRow}-${idx}`} className="border-t">
                <td className="p-2">{it.kode_transaksi || it.id_grosir}</td>
                <td className="p-2"><CustomerDetailTrigger name={it.nama_customer || (it.kode_transaksi || it.id_grosir)} kodeTransaksi={it.kode_transaksi || it.id_grosir} status={it.status_user}>{it.nama_customer || (it.kode_transaksi || it.id_grosir)}</CustomerDetailTrigger></td>
                <td className="p-2">{it.nama_produk || `${it.jenis_produk} #${it.id_produk}`}</td>
                <td className="p-2">{it.jenis_produk}</td>
                <td className="p-2 text-right">{it.jumlah}</td>
                <td className="p-2 text-right">{fmtCurrency(it.harga_produk)}</td>
                <td className="p-2 text-right">{fmtCurrency(it.jumlah_harga)}</td>
                <td className="p-2 text-right">{fmtCurrency(it.harga_modal)}</td>
                <td className="p-2 text-right">{fmtCurrency(it.jumlah_modal)}</td>
                <td className="p-2 text-right">{fmtCurrency(it.harga_ongkir)}</td>
                <td className="p-2 text-right">{fmtCurrency(it.jumlah_ongkir)}</td>
                <td className="p-2 text-right">{fmtCurrency(it.laba_item)}</td>
                <td className="p-2 text-left">{it.tanggal_log}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </td>
    </tr>
  )
}

export default function OmsetTable({ rows = [], pembukuanId, openRows, setOpenRows, itemsMap, setItemsMap }) {
  return (
    <table className={tableClass}>
      <thead className={theadClass}>
        <tr>
          <th className="p-2 text-left">Cabang</th>
          <th className="p-2 text-right">Omset Toko</th>
          <th className="p-2 text-right"># Customer</th>
          <th className="p-2 text-right"># Transaksi</th>
          <th className="p-2 text-right">Kacamata</th>
          <th className="p-2 text-right">Ganti Lensa</th>
          <th className="p-2 text-right">Ganti Frame</th>
          <th className="p-2 text-right">Softlens</th>
          <th className="p-2 text-right">Ongkir</th>
          <th className="p-2 text-right">Qty Kaca</th>
          <th className="p-2 text-right">Qty GL</th>
          <th className="p-2 text-right">Qty GF</th>
          <th className="p-2 text-right">Qty Softlens</th>
          <th className="p-2 text-left">Detail</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <React.Fragment key={r.id_cabang}>
            <tr className="border-t">
              <td className="p-2">{r.nama_cabang}</td>
              <td className="p-2 text-right">{fmtCurrency(r.total_omset)}</td>
              <td className="p-2 text-right">{fmtCurrency(r.num_customer)}</td>
              <td className="p-2 text-right">{fmtCurrency(r.num_trx)}</td>
              <td className="p-2 text-right">{fmtCurrency(r.total_kacamata)}</td>
              <td className="p-2 text-right">{fmtCurrency(r.total_ganti_lensa)}</td>
              <td className="p-2 text-right">{fmtCurrency(r.total_ganti_frame)}</td>
              <td className="p-2 text-right">{fmtCurrency(r.total_softlens)}</td>
              <td className="p-2 text-right">{fmtCurrency(r.total_ongkir)}</td>
              <td className="p-2 text-right">{fmtCurrency(r.qty_kacamata)}</td>
              <td className="p-2 text-right">{fmtCurrency(r.qty_ganti_lensa)}</td>
              <td className="p-2 text-right">{fmtCurrency(r.qty_ganti_frame)}</td>
              <td className="p-2 text-right">{fmtCurrency(r.qty_softlens)}</td>
              <td className="p-2"><RowDetailOmsetPeriod cabangId={r.id_cabang} pembukuanId={pembukuanId} openRows={openRows} setOpenRows={setOpenRows} itemsMap={itemsMap} setItemsMap={setItemsMap} /></td>
            </tr>
            <DetailRowOmsetPeriod keyRow={`period-${r.id_cabang}-${pembukuanId}`} openRows={openRows} itemsMap={itemsMap} loading={!!openRows[`period-${r.id_cabang}-${pembukuanId}`] && !itemsMap[`period-${r.id_cabang}-${pembukuanId}`]} />
          </React.Fragment>
        ))}
        {rows.length === 0 && (
          <tr><td className="p-3" colSpan={14}>Tidak ada data</td></tr>
        )}
      </tbody>
      <tfoot className="bg-slate-100">
        <tr>
          <td className="p-2 font-semibold">Total</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(rows.reduce((a, r) => a + Number(r.total_omset || 0), 0))}</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(rows.reduce((a, r) => a + Number(r.num_customer || 0), 0))}</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(rows.reduce((a, r) => a + Number(r.num_trx || 0), 0))}</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(rows.reduce((a, r) => a + Number(r.total_kacamata || 0), 0))}</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(rows.reduce((a, r) => a + Number(r.total_ganti_lensa || 0), 0))}</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(rows.reduce((a, r) => a + Number(r.total_ganti_frame || 0), 0))}</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(rows.reduce((a, r) => a + Number(r.total_softlens || 0), 0))}</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(rows.reduce((a, r) => a + Number(r.total_ongkir || 0), 0))}</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(rows.reduce((a, r) => a + Number(r.qty_kacamata || 0), 0))}</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(rows.reduce((a, r) => a + Number(r.qty_ganti_lensa || 0), 0))}</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(rows.reduce((a, r) => a + Number(r.qty_ganti_frame || 0), 0))}</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(rows.reduce((a, r) => a + Number(r.qty_softlens || 0), 0))}</td>
          <td className="p-2"></td>
        </tr>
      </tfoot>
    </table>
  )
}
