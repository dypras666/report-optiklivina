import React from 'react'
import { tableClass, theadClass } from '@/components/ui/tableStyles.js'
import { TableBodySkeleton } from '@/components/ui/TableSkeleton.jsx'

function fmtCurrency(n){ return Math.round(Number(n||0)).toLocaleString('id-ID') }
function formatDate(s){ if(!s) return ''; if(typeof s === 'string') return s.slice(0,10); try{ return new Date(s).toLocaleDateString('id-ID') }catch{ return String(s) } }

export default function LabaDetailTable({ rows = [], loading = false }){
  const totals = rows.reduce((a,r)=>({
    fix: a.fix + Number(r.fix_harga||0),
    bayar: a.bayar + Number(r.jml_bayar||0),
    sisa: a.sisa + Number(r.sisa_bayar||0),
    akt: a.akt + Number(r.laba_aktual||0),
    est: a.est + Number(r.laba_estimasi||0),
    akk: a.akk + Number(r.laba_akumulasi||0),
  }), { fix:0, bayar:0, sisa:0, akt:0, est:0, akk:0 })
  return (
    <table className={tableClass}>
      <thead className={theadClass}>
        <tr>
          <th className="p-2 text-left">Produk</th>
          <th className="p-2 text-right">Fix Harga</th>
          <th className="p-2 text-right">Jml Bayar</th>
          <th className="p-2 text-right">Sisa Bayar</th>
          <th className="p-2 text-right">Modal</th>
          <th className="p-2 text-right">Laba Aktual</th>
          <th className="p-2 text-right">Laba Estimasi</th>
          <th className="p-2 text-right">Laba Akumulasi</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <TableBodySkeleton rows={8} cols={8} />
        ) : rows.map((r, idx) => (
          <tr key={idx} className="border-t">
            <td className="p-2">{r.nama_produk}</td>
            <td className="p-2 text-right">{fmtCurrency(r.fix_harga)}</td>
            <td className="p-2 text-right">{fmtCurrency(r.jml_bayar)}</td>
            <td className="p-2 text-right">{fmtCurrency(r.sisa_bayar)}</td>
            <td className="p-2 text-right">{fmtCurrency(r.modal_total)}</td>
            <td className="p-2 text-right">{fmtCurrency(r.laba_aktual)}</td>
            <td className="p-2 text-right">{fmtCurrency(r.laba_estimasi)}</td>
            <td className="p-2 text-right">{fmtCurrency(r.laba_akumulasi)}</td>
          </tr>
        ))}
        {!loading && rows.length===0 && (
          <tr><td className="p-3" colSpan={7}>Tidak ada data</td></tr>
        )}
      </tbody>
      <tfoot className="bg-slate-100">
        <tr>
          <td className="p-2 font-semibold">Total</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(totals.fix)}</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(totals.bayar)}</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(totals.sisa)}</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(rows.reduce((a,r)=>a+Number(r.modal_total||0),0))}</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(totals.akt)}</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(totals.est)}</td>
          <td className="p-2 text-right font-semibold">{fmtCurrency(totals.akk)}</td>
        </tr>
      </tfoot>
    </table>
  )
}