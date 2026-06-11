import React, { useState, useEffect, useRef } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { cn } from "@/lib/utils"

export function Combobox({
    options = [],
    value,
    onChange,
    placeholder = "Select...",
    className
}) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState("")
    const ref = useRef(null)

    useEffect(() => {
        function handleClickOutside(event) {
            if (ref.current && !ref.current.contains(event.target)) {
                setOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    // Filter options based on search
    const filteredOptions = options.filter(opt =>
        (opt.label || "").toLowerCase().includes(search.toLowerCase())
    )

    const selectedOption = options.find(opt => String(opt.value) === String(value))

    return (
        <div className={cn("relative w-full min-w-[200px]", className)} ref={ref}>
            <div
                className="flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setOpen(!open)}
            >
                <span className={cn("truncate mr-2", !selectedOption && "text-slate-500")}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                    {value && (
                        <div
                            className="p-1 hover:bg-slate-200 rounded-full cursor-pointer transition-colors"
                            onClick={(e) => {
                                e.stopPropagation()
                                onChange("")
                            }}
                            title="Clear"
                        >
                            <X className="h-3 w-3 text-slate-500" />
                        </div>
                    )}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                </div>
            </div>

            {open && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-80 overflow-hidden flex flex-col animate-in fade-in-0 zoom-in-95 duration-200">
                    <div className="p-2 border-b sticky top-0 bg-white z-10">
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                            <input
                                autoFocus
                                className="w-full pl-8 pr-3 py-2 border rounded text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                placeholder="Cari..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="overflow-y-auto flex-1 p-1">
                        {filteredOptions.length === 0 ? (
                            <div className="py-6 text-center text-sm text-slate-500">Tidak ditemukan.</div>
                        ) : (
                            filteredOptions.map(opt => (
                                <div
                                    key={opt.value}
                                    className={cn(
                                        "px-3 py-2 text-sm rounded cursor-pointer hover:bg-slate-100 flex items-center justify-between group",
                                        String(value) === String(opt.value) && "bg-blue-50 text-blue-700"
                                    )}
                                    onClick={() => {
                                        onChange(opt.value)
                                        setOpen(false)
                                        setSearch("")
                                    }}
                                >
                                    <span className="truncate">{opt.label}</span>
                                    {String(opt.status_user) === '0' && (
                                        <span className="ml-2 text-[10px] text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200 shrink-0">
                                            Tidak Aktif
                                        </span>
                                    )}
                                    {/* Also show if status_user is present but not 0 or 1, if necessary, but assuming 0 is inactive */}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
