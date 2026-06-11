import React from 'react'
import { tableClass, theadClass } from '@/components/ui/tableStyles.js'
import { TableBodySkeleton } from '@/components/ui/TableSkeleton.jsx'

function fmtCurrency(n){
  return Number(n||0).toLocaleString('id-ID')
}

export default function TokoTable({ rows = [], loading = false }){
  return (
    <table className={tableClass}>
      <thead className={theadClass}>
        <tr>
          <th className="p-2 text-left">Cabang</th>
          <th className="p-2 text-right">Total Transaksi</th>
          <th className="p-2 text-right">Fix Harga</th>
          <th className="p-2 text-right">Jml Bayar</th>
          <th className="p-2 text-right">Presentase Bayar</th>
          <th className="p-2 text-right">Bulan Lalu</th>
          <th className="p-2 text-right">Sisa Bayar</th>
          <th className="p-2 text-right">Ongkir</th>
          <th className="p-2 text-right">Laba Item</th>
          <th className="p-2 text-right">Estimasi Laba (Belum Lunas)</th>
          <th className="p-2 text-right">Laba Klik Bayar (Sudah Lunas)</th>
          <th className="p-2 text-right">Tagihan 1 Bulan</th>
          <th className="p-2 text-right">Tagihan 3 Bulan</th>
          <th className="p-2 text-right">Tagihan 6 Bulan</th>
          <th className="p-2 text-right">Tagihan 1 Tahun</th>
          <th className="p-2 text-right">Tagihan {'>'} 1 Tahun</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <TableBodySkeleton rows={10} cols={14} />
        ) : rows.map(r => (
          <tr key={r.id_cabang} className="border-t">
            <td className="p-2">{r.nama_cabang}</td>
            <td className="p-2 text-right">{fmtCurrency(r.total_transaksi)}</td>
            <td className="p-2 text-right">{fmtCurrency(r.sum_fix_harga)}</td>
            <td className="p-2 text-right">{fmtCurrency(r.sum_jml_bayar)}</td>
            <td className="p-2 text-right">{fmtPercent(r.pct_bayar)}</td>
            <td className="p-2 text-right">{fmtPercent(r.pct_prev)}</td>
            <td className="p-2 text-right">{fmtCurrency(r.sum_sisa_bayar)}</td>
            <td className="p-2 text-right">{fmtCurrency(r.sum_ongkir_items)}</td>
            <td className="p-2 text-right">{fmtCurrency(r.sum_laba_items)}</td>
            <td className="p-2 text-right">{fmtCurrency(r.sum_laba_belum_lunas)}</td>
            <td className="p-2 text-right">{fmtCurrency(r.sum_laba_sudah_lunas)}</td>
            <td className="p-2 text-right">{fmtCurrency(r.tagihan_1_bulan)}</td>
            <td className="p-2 text-right">{fmtCurrency(r.tagihan_3_bulan)}</td>
            <td className="p-2 text-right">{fmtCurrency(r.tagihan_6_bulan)}</td>
            <td className="p-2 text-right">{fmtCurrency(r.tagihan_1_tahun)}</td>
            <td className="p-2 text-right">{fmtCurrency(r.tagihan_gt_1_tahun)}</td>
          </tr>
        ))}
        {!loading && rows.length===0 && (
          <tr><td className="p-3" colSpan={14}>Tidak ada data</td></tr>
        )}
      </tbody>
      <tfoot className="bg-slate-100">
        <tr>
          <td className="p-2 font-semibold">Total</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(rows.reduce((a,r)=>a+Number(r.total_transaksi||0),0))}</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(rows.reduce((a,r)=>a+Number(r.sum_fix_harga||0),0))}</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(rows.reduce((a,r)=>a+Number(r.sum_jml_bayar||0),0))}</td>
          <td className="p-2 text-right font-semibold">{fmtPercent(safeDiv(rows.reduce((a,r)=>a+Number(r.sum_jml_bayar||0),0), rows.reduce((a,r)=>a+Number(r.sum_fix_harga||0),0)))}</td>
          <td className="p-2 text-right font-semibold"></td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(rows.reduce((a,r)=>a+Number(r.sum_sisa_bayar||0),0))}</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(rows.reduce((a,r)=>a+Number(r.sum_ongkir_items||0),0))}</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(rows.reduce((a,r)=>a+Number(r.sum_laba_items||0),0))}</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(rows.reduce((a,r)=>a+Number(r.sum_laba_belum_lunas||0),0))}</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(rows.reduce((a,r)=>a+Number(r.sum_laba_sudah_lunas||0),0))}</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(rows.reduce((a,r)=>a+Number(r.tagihan_1_bulan||0),0))}</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(rows.reduce((a,r)=>a+Number(r.tagihan_3_bulan||0),0))}</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(rows.reduce((a,r)=>a+Number(r.tagihan_6_bulan||0),0))}</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(rows.reduce((a,r)=>a+Number(r.tagihan_1_tahun||0),0))}</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(rows.reduce((a,r)=>a+Number(r.tagihan_gt_1_tahun||0),0))}</td>
        </tr>
      </tfoot>
    </table>
  )
}

function safeDiv(a, b){
  const x = Number(a||0), y = Number(b||0)
  return y>0 ? (x/y) : 0
}

function fmtPercent(n){
  const v = Number(n||0) * 100
  return `${v.toFixed(1)}%`
}