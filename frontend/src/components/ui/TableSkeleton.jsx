import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export function TableBodySkeleton({ rows = 8, cols = 5, className = '' }){
  const r = Math.max(1, Number(rows)||0)
  const c = Math.max(1, Number(cols)||0)
  const arrR = Array.from({ length: r })
  const arrC = Array.from({ length: c })
  return (
    <>
      {arrR.map((_, rIdx) => (
        <tr key={rIdx} className={`border-t ${className}`}>
          {arrC.map((__, cIdx) => (
            <td key={cIdx} className="p-2"><Skeleton className="h-4 w-full" /></td>
          ))}
        </tr>
      ))}
    </>
  )
}