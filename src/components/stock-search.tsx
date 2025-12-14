'use client'

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

export function StockSearch() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [query, setQuery] = useState(searchParams.get('q') || '')
    const [type, setType] = useState(searchParams.get('type') || '')
    const [dim, setDim] = useState(searchParams.get('dim') || '')

    const handleSearch = () => {
        const params = new URLSearchParams()
        if (query) params.set('q', query)
        if (type) params.set('type', type)
        if (dim) params.set('dim', dim)
        router.push(`/stock?${params.toString()}`)
    }

    return (
        <div className="flex gap-4 mb-6">
            <Input
                placeholder="Search Lot/Remnant ID..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="max-w-xs"
            />
            <Input
                placeholder="Type (HEA...)"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="max-w-xs"
            />
            <Input
                placeholder="Dimensions (200...)"
                value={dim}
                onChange={(e) => setDim(e.target.value)}
                className="max-w-xs"
            />
            <Button onClick={handleSearch}>Search</Button>
        </div>
    )
}
