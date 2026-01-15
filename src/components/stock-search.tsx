'use client'

import { Input, Button, makeStyles, tokens } from '@fluentui/react-components'
import { SearchRegular } from '@fluentui/react-icons'
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

const useStyles = makeStyles({
    root: {
        display: 'flex',
        gap: '16px',
        marginBottom: '24px',
        alignItems: 'center',
    },
    input: {
        maxWidth: '300px',
    }
})

export function StockSearch() {
    const styles = useStyles()
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
        <div className={styles.root}>
            <Input
                placeholder="Search Lot/Remnant ID..."
                value={query}
                onChange={(e, d) => setQuery(d.value)}
                className={styles.input}
            />
            <Input
                placeholder="Type (HEA...)"
                value={type}
                onChange={(e, d) => setType(d.value)}
                className={styles.input}
            />
            <Input
                placeholder="Dimensions (200...)"
                value={dim}
                onChange={(e, d) => setDim(d.value)}
                className={styles.input}
            />
            <Button appearance="primary" icon={<SearchRegular />} onClick={handleSearch}>
                Search
            </Button>
        </div>
    )
}
