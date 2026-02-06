'use client'

import React from 'react'
import {
    Card,
    CardHeader,
    CardPreview,
    Text,
    Badge,
    makeStyles,
    tokens,
    shorthands,
    Tooltip,
    Table,
    TableHeader,
    TableRow,
    TableHeaderCell,
    TableBody,
    TableCell,
    TableCellLayout,
    Avatar,
} from "@fluentui/react-components";
import {
    CircleRegular,
    SquareRegular,
    InfoRegular,
    CheckmarkCircleRegular,
    WarningRegular
} from "@fluentui/react-icons";

const useStyles = makeStyles({
    patternCard: {
        marginBottom: '16px',
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        overflow: 'hidden',
    },
    patternHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        backgroundColor: tokens.colorNeutralBackground2,
        borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    },
    headerBadge: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    repetition: {
        fontSize: '18px',
        fontWeight: 'bold',
        color: tokens.colorBrandForeground1,
    },
    contentGrid: {
        display: 'grid',
        gridTemplateColumns: 'minmax(300px, 1fr) 2fr',
        gap: '24px',
        padding: '16px',
        alignItems: 'start',
        '@media (max-width: 768px)': {
            gridTemplateColumns: '1fr',
        }
    },
    summaryTable: {
        width: '100%',
    },
    visualizerSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        justifyContent: 'center',
        height: '100%',
        minHeight: '100px'
    },
    barContainer: {
        height: '48px', // Taller for better visibility
        width: '100%',
        backgroundColor: tokens.colorNeutralBackground3,
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        overflow: 'hidden',
        display: 'flex',
        border: `1px solid ${tokens.colorNeutralStroke1}`,
        position: 'relative',
        boxShadow: tokens.shadow2
    },
    barItem: {
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '11px',
        color: tokens.colorNeutralForegroundOnBrand,
        fontWeight: 'bold',
        borderRight: '1px solid rgba(255,255,255,0.3)',
        transition: 'all 0.2s ease',
        cursor: 'default',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
    },
    wasteItem: {
        height: '100%',
        backgroundColor: tokens.colorNeutralBackground3, // Light gray
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '10px',
        color: tokens.colorNeutralForeground3,
        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.1) 5px, rgba(0,0,0,0.1) 10px)'
    },
});

interface GroupedPart {
    partNumber: string
    length: number
    quantityPerBar: number
    totalQuantity: number
}

interface PatternGroup {
    id: string
    repetition: number
    length: number
    efficiency: number
    waste: number
    parts: GroupedPart[]
    flattenedParts: { partNumber: string, length: number }[] // For visualization segments
    sourceType: 'INVENTORY' | 'NEW' | 'REMNANT'
    stockIds?: string[] // For Inventory traceability
}

function getPatternGroups(result: OptimizationResult | null): PatternGroup[] {
    if (!result) return [];

    const groups: Record<string, PatternGroup> = {};
    const singles: PatternGroup[] = []; // Remnants don't group

    // 1. Process Stock Used (Inventory/Remnants)
    result.stockUsed.forEach(stock => {
        if (stock.stockType === 'REMNANT') {
            // Remnants are unique
            singles.push({
                id: stock.stockId,
                repetition: 1,
                length: stock.originalLength,
                efficiency: (stock.originalLength - stock.waste) / stock.originalLength,
                waste: stock.waste,
                sourceType: 'REMNANT',
                stockIds: [stock.stockId],
                parts: condenseParts(stock.parts),
                flattenedParts: stock.parts
            })
        } else {
            // Inventory - Groupable
            // Signature: Length + Sorted Parts
            const partSig = stock.parts
                .map(p => `${p.length}-${p.partNumber}`)
                .sort()
                .join('|');
            const key = `INV-${stock.originalLength}-${partSig}`;

            if (!groups[key]) {
                groups[key] = {
                    id: key,
                    repetition: 0,
                    length: stock.originalLength,
                    efficiency: (stock.originalLength - stock.waste) / stock.originalLength,
                    waste: stock.waste,
                    sourceType: 'INVENTORY',
                    stockIds: [],
                    parts: condenseParts(stock.parts),
                    flattenedParts: stock.parts
                }
            }
            groups[key].repetition++;
            groups[key].stockIds?.push(stock.stockId);
        }
    });

    // 2. Process New Stock
    result.newStockNeeded.forEach(stock => {
        // New stock is usually already grouped by length/qty/pattern in the optimizer output structure?
        // Actually the optimizer output `newStockNeeded` implies a grouping (length, quantity, parts ref).
        // BUT `parts` array in `newStockNeeded` typically lists ALL parts for ALL bars of that type? 
        // Let's verify standard OptimizationResult structure. 
        // Typically `newStockNeeded` is: "Buy 5 bars of 6m. Here are the parts for Bar 1, Bar 2...?"
        // NO. Usually `newStockNeeded` array elements represent a *Pattern*. 
        // "Pattern A used 5 times".
        // Let's look at Step 332 interface: `newStockNeeded: { quantity: number, parts: {...}[] }[]`.
        // The `quantity` implies repetition. The `parts` array likely describes ONE instance of the pattern.

        const efficiency = (stock.length - (stock.length - stock.parts.reduce((s, p) => s + p.length, 0))) / stock.length;
        const waste = stock.length - stock.parts.reduce((s, p) => s + p.length, 0);

        // We treat this as a pre-grouped pattern
        const group: PatternGroup = {
            id: `NEW-${Math.random().toString(36).substr(2, 9)}`, // Temp ID
            repetition: stock.quantity,
            length: stock.length,
            efficiency: efficiency, // Approx or recalc
            waste: waste,
            sourceType: 'NEW',
            parts: condenseParts(stock.parts),
            flattenedParts: stock.parts
        };
        singles.push(group); // Push as a distinct group item
    });

    return [...Object.values(groups), ...singles].sort((a, b) => b.repetition - a.repetition);
}

function condenseParts(parts: { partNumber: string, length: number }[]): GroupedPart[] {
    const map: Record<string, GroupedPart> = {};
    parts.forEach(p => {
        const key = `${p.partNumber}-${p.length}`;
        if (!map[key]) {
            map[key] = {
                partNumber: p.partNumber,
                length: p.length,
                quantityPerBar: 0,
                totalQuantity: 0 // Will be calc later x Repetition
            }
        }
        map[key].quantityPerBar++;
    });
    return Object.values(map).sort((a, b) => b.length - a.length);
}

interface OptimizationResult {
    stockUsed: {
        stockId: string
        stockType: 'INVENTORY' | 'REMNANT'
        originalLength: number
        usedLength: number
        waste: number
        parts: { partId: string, length: number, partNumber: string }[]
    }[]
    newStockNeeded: {
        length: number
        quantity: number
        parts: { partId: string, length: number, partNumber: string }[]
    }[]
    unallocated: { id: string, length: number }[]
    efficiency: number
}

interface NestingVisualizerProps {
    plan: {
        materialKey: string
        profile: string
        grade: string
        result: OptimizationResult
    }
    extraHeaderContent?: React.ReactNode
}

export function NestingVisualizer({ plan, extraHeaderContent }: NestingVisualizerProps) {
    const styles = useStyles();
    const { profile, grade, result } = plan;

    const patternGroups = React.useMemo(() => getPatternGroups(result), [result]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className={styles.patternHeader} style={{ borderRadius: tokens.borderRadiusMedium, border: `1px solid ${tokens.colorNeutralStroke2}` }}>
                <Text weight="semibold" size={400}>{profile} - {grade}</Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Text>Efficiency:</Text>
                        <Badge
                            appearance="filled"
                            color={result.efficiency > 0.85 ? "success" : result.efficiency < 0.70 ? "important" : "warning"}
                        >
                            {Math.round(result.efficiency * 100)}%
                        </Badge>
                    </div>
                    {extraHeaderContent}
                </div>
            </div>

            {patternGroups.map((group) => (
                <PatternCard key={group.id} group={group} />
            ))}

            {result.unallocated.length > 0 && (
                <div style={{ padding: '8px', backgroundColor: tokens.colorPaletteRedBackground1, border: `1px solid ${tokens.colorPaletteRedBorder1}`, borderRadius: tokens.borderRadiusMedium, color: tokens.colorPaletteRedForeground1 }}>
                    <Text weight="bold">Warning:</Text> {result.unallocated.length} parts could not be nested (Too long?).
                </div>
            )}
        </div>
    )
}

function PatternCard({ group }: { group: PatternGroup }) {
    const styles = useStyles();
    const [hoveredPart, setHoveredPart] = React.useState<string | null>(null);

    return (
        <div className={styles.patternCard}>
            {/* HEADER */}
            <div className={styles.patternHeader}>
                <div className={styles.headerBadge}>
                    <span className={styles.repetition}>{group.repetition}x</span>
                    <Text weight="semibold" style={{ marginLeft: '8px' }}>
                        {group.length}mm Stock
                    </Text>
                    {group.sourceType === 'INVENTORY' ? (
                        <Tooltip content={group.stockIds?.join(', ') || ''} relationship="description">
                            <Badge appearance="tint" color="brand" icon={<CheckmarkCircleRegular />}>
                                {group.stockIds?.length === 1
                                    ? `Lot: ${group.stockIds[0].slice(-6)}`
                                    : `Mixed (${group.stockIds?.length} Lots)`}
                            </Badge>
                        </Tooltip>
                    ) : group.sourceType === 'REMNANT' ? (
                        <Badge appearance="tint" color="warning" icon={<WarningRegular />}>
                            Remnant #{group.id.slice(-4)}
                        </Badge>
                    ) : (
                        <Badge appearance="outline" color="danger" icon={<CircleRegular />}>
                            New Stock
                        </Badge>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '10px', color: tokens.colorNeutralForeground3 }}>
                    <span>Waste: {Math.round(group.waste)}mm</span>
                    <span>Util: {Math.round(group.efficiency * 100)}%</span>
                </div>
            </div>

            {/* CONTENT GRID */}
            <div className={styles.contentGrid}>
                {/* 1. TABLE */}
                <div className={styles.summaryTable}>
                    <Table size="small" aria-label="Parts summary">
                        <TableHeader>
                            <TableRow>
                                <TableHeaderCell>Part #</TableHeaderCell>
                                <TableHeaderCell>Len</TableHeaderCell>
                                <TableHeaderCell>Qty/Bar</TableHeaderCell>
                                <TableHeaderCell>Total</TableHeaderCell>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {group.parts.map((p, i) => (
                                <TableRow
                                    key={i}
                                    style={{
                                        backgroundColor: hoveredPart === p.partNumber ? tokens.colorNeutralBackground2 : 'transparent',
                                        cursor: 'default'
                                    }}
                                    onMouseEnter={() => setHoveredPart(p.partNumber)}
                                    onMouseLeave={() => setHoveredPart(null)}
                                >
                                    <TableCell>
                                        <Text weight="semibold">{p.partNumber}</Text>
                                    </TableCell>
                                    <TableCell>{p.length}</TableCell>
                                    <TableCell>{p.quantityPerBar}</TableCell>
                                    <TableCell>
                                        <Text weight="bold">{p.quantityPerBar * group.repetition}</Text>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {/* 2. VISUALIZER */}
                <div className={styles.visualizerSection}>
                    <BarVisualizer
                        totalLength={group.length}
                        parts={group.flattenedParts}
                        waste={group.waste}
                        hoveredPart={hoveredPart}
                        onHoverPart={setHoveredPart}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: tokens.colorNeutralForeground3, padding: '0 4px' }}>
                        <span>0mm</span>
                        <span>{group.length}mm</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

function BarVisualizer({ totalLength, parts, waste, hoveredPart, onHoverPart }: {
    totalLength: number,
    parts: { length: number, partNumber: string }[],
    waste: number,
    hoveredPart?: string | null,
    onHoverPart?: (part: string | null) => void
}) {
    const styles = useStyles();

    return (
        <div className={styles.barContainer}>
            {parts.map((p, i) => {
                const isHovered = hoveredPart === p.partNumber;
                const opacity = hoveredPart && !isHovered ? 0.4 : 1;
                const scale = isHovered ? '1.05' : '1';
                const zIndex = isHovered ? 10 : 1;

                return (
                    <Tooltip key={i} content={`${p.partNumber} - ${p.length}mm`} relationship="label">
                        <div
                            className={styles.barItem}
                            style={{
                                width: `${(p.length / totalLength) * 100}%`,
                                backgroundColor: tokens.colorPaletteBlueBackground2,
                                border: isHovered ? `2px solid ${tokens.colorPaletteBlueBorderActive}` : undefined,
                                opacity,
                                zIndex,
                                transform: isHovered ? 'scaleY(1.1)' : undefined,
                            }}
                            onMouseEnter={() => onHoverPart && onHoverPart(p.partNumber)}
                            onMouseLeave={() => onHoverPart && onHoverPart(null)}
                        >
                            {/* Only show text if wide enough */}
                            {(p.length / totalLength) > 0.08 && p.partNumber}
                        </div>
                    </Tooltip>
                )
            })}
            {waste > 0 && (
                <Tooltip content={`Waste: ${Math.round(waste)}mm`} relationship="label">
                    <div
                        className={styles.wasteItem}
                        style={{
                            width: `${(waste / totalLength) * 100}%`
                        }}
                    >
                        {waste > 300 && `${Math.round(waste)}`}
                    </div>
                </Tooltip>
            )}
        </div>
    )
}
