import React from 'react'
import { Button } from '@/components/ui/button'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://reportsapi.optiklivina.com'

export default function KtpRegister(){
  const params = new URLSearchParams(window.location.hash.split('?')[1]||'')
  const [code, setCode] = React.useState(params.get('code')||'')
  const [img, setImg] = React.useState(null)
  const [previewUrl, setPreviewUrl] = React.useState('')
  const [result, setResult] = React.useState(null)
  const [loading, setLoading] = React.useState(false)
  const videoRef = React.useRef(null)

  async function openCamera(){
    if(!('BarcodeDetector' in window)){
      alert('BarcodeDetector tidak tersedia, masukkan kode manual')
      return
    }
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    const video = videoRef.current
    video.srcObject = stream
    video.play()
    const scanLoop = async () => {
      if(!videoRef.current) return
      try{
        const codes = await detector.detect(video)
        if(codes && codes.length){
          const raw = codes[0].rawValue || ''
          const url = new URL(raw, window.location.origin)
          const c = (url.searchParams.get('code') || raw).replace(/[^0-9]/g,'')
          if(c && c.length===4){ setCode(c); stopCamera() }
        }
      }catch{}
      requestAnimationFrame(scanLoop)
    }
    requestAnimationFrame(scanLoop)
  }
  function stopCamera(){
    const v = videoRef.current
    try{ v.pause(); v.srcObject?.getTracks()?.forEach(t=>t.stop()) }catch{}
  }

  function onFile(e){
    const f = e.target.files?.[0]
    if(!f) return
    setImg(f)
    const url = URL.createObjectURL(f)
    setPreviewUrl(url)
  }

  async function compressImage(file){
    const imgEl = document.createElement('img')
    const url = URL.createObjectURL(file)
    await new Promise(r=>{ imgEl.onload=r; imgEl.src=url })
    const maxW = 1600
    const scale = Math.min(1, maxW / imgEl.width)
    const w = Math.round(imgEl.width * scale)
    const h = Math.round(imgEl.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(imgEl, 0, 0, w, h)
    const blob = await new Promise(res => canvas.toBlob(b => res(b), 'image/jpeg', 0.8))
    return new File([blob], file.name.replace(/\.[^.]+$/,'')+'.jpg', { type: 'image/jpeg' })
  }

  async function submit(){
    if(!code || code.length!==4){ alert('Masukkan kode 4 angka'); return }
    if(!img){ alert('Pilih foto KTP'); return }
    setLoading(true)
    try{
      const comp = await compressImage(img)
      const fd = new FormData()
      fd.append('code', code)
      fd.append('file', comp)
      const res = await fetch(`${API_BASE}/api/ktp/scan`, { method: 'POST', body: fd })
      const json = await res.json()
      if(json?.ok){ setResult(json.parsed) }
      else { alert(json?.error || 'Gagal memproses KTP') }
    }catch(e){ alert(String(e)) }
    finally{ setLoading(false) }
  }

  function reset(){ setImg(null); setPreviewUrl(''); setResult(null) }

  return (
    <div className="p-3">
      <h1 className="text-xl font-semibold mb-2">Register Customer via KTP</h1>
      <div className="flex gap-3 items-end mb-3">
        <div>
          <label className="block text-sm">Kode (4 angka)</label>
          <input className="border rounded px-2 py-1 w-28" value={code} onChange={e=>setCode(e.target.value.replace(/[^0-9]/g,'').slice(0,4))} />
        </div>
        <Button variant="outline" onClick={openCamera}>Scan QR</Button>
      </div>
      <video ref={videoRef} className="w-full max-w-md rounded mb-3" muted playsInline></video>
      <div className="mb-3">
        <label className="block text-sm mb-1">Foto KTP</label>
        <input type="file" accept="image/*" onChange={onFile} />
        {previewUrl && (
          <div className="mt-2 border-2 border-dashed border-slate-400 rounded p-2 inline-block">
            <img src={previewUrl} alt="preview" className="max-w-md" />
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button onClick={submit} disabled={loading}>{loading ? 'Memproses...' : 'Upload & Parse'}</Button>
        <Button variant="outline" onClick={reset}>Reupload</Button>
      </div>
      {result && (
        <div className="mt-4 p-3 border rounded bg-slate-50 text-sm">
          <div>NIK: <b>{result.nik}</b></div>
          <div>Nama: <b>{result.nama}</b></div>
          <div>TTL: <b>{result.tempatLahir}</b>, <b>{result.tanggalLahir}</b></div>
          <div>JK: <b>{result.jenisKelamin}</b></div>
          <div>Alamat: <b>{result.alamat}</b></div>
          <div>Kel/Desa: <b>{result.kelurahanDesa}</b></div>
          <div>Kecamatan: <b>{result.kecamatan}</b></div>
          <div>Kab/Kota: <b>{result.kabupatenKota}</b></div>
          <div>Provinsi: <b>{result.provinsi}</b></div>
        </div>
      )}
    </div>
  )
}
