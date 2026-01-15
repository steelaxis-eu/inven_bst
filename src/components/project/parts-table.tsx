'use client'

import { useState } from 'react'
import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableHeaderCell,
    TableRow,
    Badge,
    Button,
    ProgressBar,
    Checkbox,
    makeStyles,
    tokens,
    Text,
    shorthands
} from "@fluentui/react-components"
import {
    ChevronDownRegular,
    ChevronRightRegular,
    BoxRegular,
    WrenchRegular
} from "@fluentui/react-icons"
import { CreatePartWODialog } from './create-part-wo-dialog'

interface Part {
    id: string
    partNumber: string
    description: string | null
    profile: { type: string; dimensions: string } | null
    grade: { name: string } | null
    length: number | null
    quantity: number
    unitWeight: number
    requiresWelding: boolean
    pieces: { id: string; pieceNumber: number; status: string }[]
}

interface PartsTableProps {
    parts: Part[]
    projectId: string
    onPieceStatusChange?: (pieceId: string, status: string) => void
}

const useStyles = makeStyles({
    root: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
    },
    selectionToolbar: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px',
        backgroundColor: tokens.colorPaletteBlueBackground2,
        borderRadius: tokens.borderRadiusMedium,
        ...shorthands.border('1px', 'solid', tokens.colorBrandStroke1),
    },
    expandableRow: {
        backgroundColor: tokens.colorNeutralBackground2,
    },
    piecesGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(40px, 1fr))',
        gap: '4px',
        marginTop: '8px',
    },
    pieceBadge: {
        cursor: 'pointer',
        textAlign: 'center',
        fontSize: '12px',
        padding: '4px',
        borderRadius: '4px',
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        ':hover': {
            backgroundColor: tokens.colorNeutralBackground1Hover,
        }
    },
    selectedPiece: {
        ring: `2px solid ${tokens.colorBrandStroke1}`,
        zIndex: 1,
    }
})

const STATUS_COLORS: Record<string, string> = {
    'NOT_STARTED': tokens.colorNeutralBackground3,
    'CUT': tokens.colorPaletteBlueBackground2,
    'FABRICATED': tokens.colorPaletteYellowBackground2,
    'WELDED': tokens.colorPaletteDarkOrangeBackground2,
    'PAINTED': tokens.colorPalettePurpleBackground2,
    'READY': tokens.colorPaletteGreenBackground2,
}

interface SelectedPiece {
    pieceId: string
    partNumber: string
    pieceNumber: number
    status: string
}

export function PartsTable({ parts, projectId, onPieceStatusChange }: PartsTableProps) {
    const styles = useStyles()
    const [expandedParts, setExpandedParts] = useState<Set<string>>(new Set())
    const [selectedPieces, setSelectedPieces] = useState<SelectedPiece[]>([])
    const [woDialogOpen, setWoDialogOpen] = useState(false)

    const toggleExpand = (partId: string) => {
        const newExpanded = new Set(expandedParts)
        if (newExpanded.has(partId)) {
            newExpanded.delete(partId)
        } else {
            newExpanded.add(partId)
        }
        setExpandedParts(newExpanded)
    }

    const getProgress = (pieces: Part['pieces']) => {
        if (pieces.length === 0) return 0
        const ready = pieces.filter(p => p.status === 'READY').length
        return Math.round((ready / pieces.length) * 100)
    }

    const getStatusCounts = (pieces: Part['pieces']) => {
        const counts: Record<string, number> = {}
        pieces.forEach(p => {
            counts[p.status] = (counts[p.status] || 0) + 1
        })
        return counts
    }

    const togglePieceSelection = (piece: { id: string; pieceNumber: number; status: string }, partNumber: string) => {
        const existing = selectedPieces.find(p => p.pieceId === piece.id)
        if (existing) {
            setSelectedPieces(selectedPieces.filter(p => p.pieceId !== piece.id))
        } else {
            setSelectedPieces([...selectedPieces, {
                pieceId: piece.id,
                partNumber,
                pieceNumber: piece.pieceNumber,
                status: piece.status
            }])
        }
    }

    const toggleAllPiecesForPart = (part: Part) => {
        const partPieceIds = part.pieces.map(p => p.id)
        const allSelected = partPieceIds.every(id => selectedPieces.some(sp => sp.pieceId === id))

        if (allSelected) {
            setSelectedPieces(selectedPieces.filter(sp => !partPieceIds.includes(sp.pieceId)))
        } else {
            const newSelections = part.pieces
                .filter(p => !selectedPieces.some(sp => sp.pieceId === p.id))
                .map(p => ({
                    pieceId: p.id,
                    partNumber: part.partNumber,
                    pieceNumber: p.pieceNumber,
                    status: p.status
                }))
            setSelectedPieces([...selectedPieces, ...newSelections])
        }
    }

    const isPartFullySelected = (part: Part) => {
        return part.pieces.every(p => selectedPieces.some(sp => sp.pieceId === p.id))
    }

    if (parts.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '48px', border: `1px dashed ${tokens.colorNeutralStroke1}`, borderRadius: tokens.borderRadiusMedium }}>
                <BoxRegular fontSize={48} style={{ opacity: 0.5, color: tokens.colorNeutralForeground3 }} />
                <div style={{ marginTop: '8px', fontWeight: 600 }}>No parts added yet</div>
                <Text>Add your first BOM part to get started.</Text>
            </div>
        )
    }

    return (
        <div className={styles.root}>
            {/* Selection Toolbar */}
            {selectedPieces.length > 0 && (
                <div className={styles.selectionToolbar}>
                    <span style={{ color: tokens.colorPaletteBlueForeground2, fontWeight: 500 }}>
                        {selectedPieces.length} piece{selectedPieces.length !== 1 ? 's' : ''} selected
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <Button
                            size="small"
                            onClick={() => setSelectedPieces([])}
                        >
                            Clear
                        </Button>
                        <Button
                            size="small"
                            appearance="primary"
                            icon={<WrenchRegular />}
                            onClick={() => setWoDialogOpen(true)}
                        >
                            Create Work Order
                        </Button>
                    </div>
                </div>
            )}

            <div style={{ border: `1px solid ${tokens.colorNeutralStroke1}`, borderRadius: tokens.borderRadiusMedium, overflow: 'hidden' }}>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHeaderCell style={{ width: '40px' }}></TableHeaderCell>
                            <TableHeaderCell>Part #</TableHeaderCell>
                            <TableHeaderCell>Description</TableHeaderCell>
                            <TableHeaderCell>Profile</TableHeaderCell>
                            <TableHeaderCell>Grade</TableHeaderCell>
                            <TableHeaderCell style={{ textAlign: 'right' }}>Length</TableHeaderCell>
                            <TableHeaderCell style={{ textAlign: 'right' }}>Qty</TableHeaderCell>
                            <TableHeaderCell style={{ textAlign: 'right' }}>Weight</TableHeaderCell>
                            <TableHeaderCell style={{ width: '200px' }}>Progress</TableHeaderCell>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {parts.map(part => {
                            const isExpanded = expandedParts.has(part.id)
                            const progress = getProgress(part.pieces)
                            const statusCounts = getStatusCounts(part.pieces)

                            return (
                                <>
                                    <TableRow
                                        key={part.id}
                                        onClick={() => toggleExpand(part.id)}
                                        style={{ cursor: 'pointer', backgroundColor: isExpanded ? tokens.colorNeutralBackground1 : undefined }}
                                    >
                                        <TableCell>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                {isExpanded ? <ChevronDownRegular /> : <ChevronRightRegular />}
                                            </div>
                                        </TableCell>
                                        <TableCell style={{ fontFamily: 'monospace', fontWeight: 500 }}>{part.partNumber}</TableCell>
                                        <TableCell><Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>{part.description || '-'}</Text></TableCell>
                                        <TableCell>
                                            {part.profile ? `${part.profile.type} ${part.profile.dimensions}` : '-'}
                                        </TableCell>
                                        <TableCell>{part.grade?.name || '-'}</TableCell>
                                        <TableCell style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                                            {part.length ? `${part.length.toLocaleString()} mm` : '-'}
                                        </TableCell>
                                        <TableCell style={{ textAlign: 'right', fontWeight: 500 }}>{part.quantity}</TableCell>
                                        <TableCell style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                                            {part.unitWeight > 0 ? `${(part.unitWeight * part.quantity).toFixed(1)} kg` : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <ProgressBar value={progress / 100} style={{ flex: 1 }} />
                                                <span style={{ fontSize: '12px', width: '30px' }}>{progress}%</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                    {isExpanded && (
                                        <TableRow key={`${part.id}-pieces`}>
                                            <TableCell colSpan={9} className={styles.expandableRow}>
                                                <div style={{ padding: '12px' }}>
                                                    {/* Status summary and select all */}
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                            {Object.entries(statusCounts).map(([status, count]) => (
                                                                <Badge key={status} appearance="outline">
                                                                    {status}: {count}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                        <Button
                                                            size="small"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                toggleAllPiecesForPart(part)
                                                            }}
                                                        >
                                                            {isPartFullySelected(part) ? 'Deselect All' : 'Select All'}
                                                        </Button>
                                                    </div>

                                                    {/* Pieces grid */}
                                                    <div className={styles.piecesGrid}>
                                                        {part.pieces.map(piece => {
                                                            const isSelected = selectedPieces.some(sp => sp.pieceId === piece.id)
                                                            return (
                                                                <div
                                                                    key={piece.id}
                                                                    className={`${styles.pieceBadge} ${isSelected ? styles.selectedPiece : ''}`}
                                                                    style={{ backgroundColor: STATUS_COLORS[piece.status] }}
                                                                    title={`Piece ${piece.pieceNumber}: ${piece.status}`}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        togglePieceSelection(piece, part.partNumber)
                                                                    }}
                                                                >
                                                                    {piece.pieceNumber}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>

            <CreatePartWODialog
                projectId={projectId}
                selectedPieces={selectedPieces}
                open={woDialogOpen}
                onOpenChange={(open) => {
                    setWoDialogOpen(open)
                    if (!open) setSelectedPieces([])
                }}
            />
        </div>
    )
}
