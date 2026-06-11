import React from 'react'
import { Button } from '@/components/ui/button'

export default function Pagination({
  page = 1,
  totalPages = 0,
  total = 0,
  disabledPrev = false,
  disabledNext = false,
  onPrev,
  onNext,
  onJump,
  className = ''
}){
  const [jump, setJump] = React.useState('')
  function doJump(){
    const p = parseInt(jump, 10)
    if (!Number.isFinite(p)) return
    if (p < 1) return onJump ? onJump(1) : undefined
    if (totalPages && p > totalPages) return onJump ? onJump(totalPages) : undefined
    onJump && onJump(p)
  }
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm text-slate-600">Halaman {page} dari {totalPages} • Total {total} data</span>
      <div className="ml-auto flex items-center gap-2">
        <Button className="border" disabled={disabledPrev} onClick={onPrev}>Prev</Button>
        <Button className="border" disabled={disabledNext} onClick={onNext}>Next</Button>
        <div className="flex items-center gap-1">
          <input type="number" min={1} className="border rounded px-2 py-1 w-20" placeholder="Lompat" value={jump} onChange={e=>setJump(e.target.value)} />
          <Button className="border" disabled={!onJump} onClick={doJump}>Go</Button>
        </div>
      </div>
    </div>
  )
}