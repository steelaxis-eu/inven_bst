'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { searchStock, StockItem } from '@/app/actions/stock'
import { SearchableSelect } from "@/components/ui/searchable-select"

export function UsageWizard({ projects }: { projects: any[] }) {
    const router = useRouter()
    const [projectId, setProjectId] = useState('')
    const [lines, setLines] = useState<any[]>([])

    // Line Entry State
    const [searchTerm, setSearchTerm] = useState('')
    const [searchResults, setSearchResults] = useState<StockItem[]>([])
    const [selectedItem, setSelectedItem] = useState<StockItem | null>(null)
    const [lengthUsed, setLengthUsed] = useState('')
    const [createRemnant, setCreateRemnant] = useState(false)
    const [quantity, setQuantity] = useState('1')

    const handleSearch = async () => {
        if (!searchTerm) return
        const results = await searchStock(searchTerm)
        setSearchResults(results)
    }

    const handleSelect = (item: StockItem) => {
        setSelectedItem(item)
        setSearchResults([])
        setSearchTerm('')
        setLengthUsed('')
        setCreateRemnant(false)
        setQuantity('1')
    }

    const handleAddLine = () => {
        if (!selectedItem || !lengthUsed || !quantity) return
        const used = parseFloat(lengthUsed)
        const qty = parseInt(quantity)

        if (isNaN(used) || used <= 0 || used > selectedItem.length) {
            alert("Invalid length")
            return
        }
        if (isNaN(qty) || qty <= 0) {
            alert("Invalid quantity")
            return
        }

        setLines([...lines, {
            type: selectedItem.type,
            id: selectedItem.id,
            originalId: selectedItem.originalId,
            profile: `${selectedItem.profileType} ${selectedItem.dimensions}`,
            lengthAvailable: selectedItem.length,
            lengthUsed: used,
            createRemnant,
            quantity: qty
        }])

        setSelectedItem(null)
        setLengthUsed('')
        setCreateRemnant(false)
        setQuantity('1')
    }

    const handleSubmit = async () => {
        if (!projectId || lines.length === 0) return

        try {
            const res = await fetch('/api/usage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    userId: 'user-demo', // Mock
                    lines
                })
            })

            if (!res.ok) throw new Error(await res.text())

            alert("Usage recorded successfully!")
            setLines([])
            setProjectId('')
            router.refresh()
        } catch (e: any) {
            alert(`Error: ${e.message}`)
        }
    }

    const showRemnantOption = selectedItem && lengthUsed && parseFloat(lengthUsed) < selectedItem.length

    return (
        <div className="grid gap-6">
            <Card>
                <CardHeader><CardTitle>1. Select Project</CardTitle></CardHeader>
                <CardContent>
                    <SearchableSelect
                        value={projectId}
                        onValueChange={setProjectId}
                        placeholder="Select Project"
                        searchPlaceholder="Search project..."
                        items={projects.map(p => ({
                            value: p.id,
                            label: `${p.projectNumber} - ${p.name}`
                        }))}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>2. Add Usage Lines</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Input
                            placeholder="Search Lot ID or Remnant ID..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        />
                        <Button onClick={handleSearch} variant="secondary">Find</Button>
                    </div>

                    {searchResults.length > 0 && (
                        <div className="border rounded p-2 max-h-40 overflow-auto bg-slate-50">
                            {searchResults.map(item => (
                                <div key={item.id}
                                    className="p-2 hover:bg-slate-200 cursor-pointer flex justify-between"
                                    onClick={() => handleSelect(item)}
                                >
                                    <span className="font-mono font-bold">{item.originalId}</span>
                                    <span>{item.profileType} {item.dimensions} - {item.length}mm</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {selectedItem && (
                        <div className="border p-4 rounded bg-slate-100 space-y-4">
                            <div className="font-semibold">Selected: {selectedItem.originalId} ({selectedItem.length}mm)</div>

                            <div className="flex items-end gap-4">
                                <div className="grid gap-2 w-32">
                                    <Label>Quantity</Label>
                                    <Input
                                        type="number"
                                        value={quantity}
                                        onChange={e => setQuantity(e.target.value)}
                                        min="1"
                                    />
                                </div>
                                <div className="grid gap-2 flex-1">
                                    <Label>Length Used (mm)</Label>
                                    <Input
                                        type="number"
                                        value={lengthUsed}
                                        onChange={e => setLengthUsed(e.target.value)}
                                        max={selectedItem.length}
                                    />
                                </div>
                            </div>

                            {showRemnantOption && (
                                <div className="bg-white p-3 rounded border space-y-2">
                                    <Label className="text-sm font-semibold">Remaining Material Action ({selectedItem.length - parseFloat(lengthUsed)}mm):</Label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center space-x-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="remnantAction"
                                                checked={createRemnant === true}
                                                onChange={() => setCreateRemnant(true)}
                                                className="h-4 w-4 text-blue-600"
                                            />
                                            <span>Save as Remnant</span>
                                        </label>
                                        <label className="flex items-center space-x-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="remnantAction"
                                                checked={createRemnant === false}
                                                onChange={() => setCreateRemnant(false)}
                                                className="h-4 w-4 text-red-600"
                                            />
                                            <span>Mark as Scrap (Discard)</span>
                                        </label>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end">
                                <Button onClick={handleAddLine}>Add Line</Button>
                            </div>
                        </div>
                    )}

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead>Profile</TableHead>
                                <TableHead>Qty</TableHead>
                                <TableHead>Length Used</TableHead>
                                <TableHead>Remnant?</TableHead>
                                <TableHead></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {lines.map((line, idx) => (
                                <TableRow key={idx}>
                                    <TableCell>{line.originalId}</TableCell>
                                    <TableCell>{line.profile}</TableCell>
                                    <TableCell>{line.quantity}</TableCell>
                                    <TableCell>{line.lengthUsed}</TableCell>
                                    <TableCell>{line.createRemnant ? 'Yes' : 'No'}</TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="sm" onClick={() => setLines(lines.filter((_, i) => i !== idx))}>Remove</Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    <div className="flex justify-end">
                        <Button size="lg" onClick={handleSubmit} disabled={!projectId || lines.length === 0}>
                            Commit Usage
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
