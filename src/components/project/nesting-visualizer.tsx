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
} from "@fluentui/react-components";
import {
    CircleRegular,
    SquareRegular
} from "@fluentui/react-icons";

const useStyles = makeStyles({
    container: {
        marginBottom: '16px',
        width: '100%',
        boxShadow: tokens.shadow2,
    },
    header: {
        padding: '8px 16px',
        backgroundColor: tokens.colorNeutralBackground2,
        borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    content: {
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
    },
    sectionTitle: {
        fontWeight: 'bold',
        color: tokens.colorNeutralForeground2,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px',
    },
    barContainer: {
        height: '24px',
        width: '100%',
        backgroundColor: tokens.colorNeutralBackground3,
        ...shorthands.borderRadius(tokens.borderRadiusSmall),
        overflow: 'hidden',
        display: 'flex',
        border: `1px solid ${tokens.colorNeutralStroke1}`,
        position: 'relative'
    },
    barItem: {
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '9px',
        color: tokens.colorNeutralForegroundOnBrand,
        fontWeight: 'bold',
        borderRight: '1px solid rgba(255,255,255,0.2)',
    },
    wasteItem: {
        height: '100%',
        backgroundColor: tokens.colorNeutralBackground3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '9px',
        color: tokens.colorNeutralForeground3,
        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.05) 5px, rgba(0,0,0,0.05) 10px)'
    },
    infoRow: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '10px',
        color: tokens.colorNeutralForeground3,
        marginBottom: '4px'
    }
});

interface OptimizationResult {
    stockUsed: {
        stockId: string
        stockType: 'INVENTORY' | 'REMNANT'
        originalLength: number
        usedLength: number
        waste: number
        parts: { partId: string, length: number }[]
    }[]
    newStockNeeded: {
        length: number
        quantity: number
        parts: { partId: string, length: number }[]
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

    return (
        <Card className={styles.container}>
            <div className={styles.header}>
                <Text weight="semibold">{profile} - {grade}</Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Text size={200}>Efficiency:</Text>
                    <Badge
                        appearance={result.efficiency > 0.85 ? "filled" : "outline"}
                        color={result.efficiency > 0.85 ? "success" : "important"}
                    >
                        {Math.round(result.efficiency * 100)}%
                    </Badge>
                    {extraHeaderContent}
                </div>
            </div>

            <div className={styles.content}>
                {/* 1. EXISTING STOCK USAGE */}
                {result.stockUsed.length > 0 && (
                    <div>
                        <div className={styles.sectionTitle}>
                            <CircleRegular style={{ color: tokens.colorPaletteBlueBorderActive }} />
                            <span>Using {result.stockUsed.length} Existing Items (Stock/Remnants)</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {result.stockUsed.map((stock, idx) => (
                                <div key={stock.stockId + idx}>
                                    <div className={styles.infoRow}>
                                        <span>{stock.stockType} #{stock.stockId.slice(-4)}</span>
                                        <span>{stock.originalLength}mm</span>
                                    </div>
                                    <BarVisualizer
                                        totalLength={stock.originalLength}
                                        parts={stock.parts}
                                        waste={stock.waste}
                                        type="stock"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 2. NEW STOCK NEEDED */}
                {result.newStockNeeded.length > 0 && (
                    <div>
                        <div className={styles.sectionTitle}>
                            <CircleRegular style={{ color: tokens.colorPaletteRedBorderActive }} />
                            <span>Buy {result.newStockNeeded.reduce((s, x) => s + x.quantity, 0)} New Bars</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {result.newStockNeeded.map((stock, idx) => (
                                <div key={idx}>
                                    <div className={styles.infoRow}>
                                        <span>New Bar ({stock.quantity}x)</span>
                                        <span>{stock.length}mm</span>
                                    </div>
                                    <BarVisualizer
                                        totalLength={stock.length}
                                        parts={stock.parts}
                                        waste={stock.length - stock.parts.reduce((s, p) => s + p.length, 0)}
                                        type="new"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 3. UNALLOCATED */}
                {result.unallocated.length > 0 && (
                    <div style={{ padding: '8px', backgroundColor: tokens.colorPaletteRedBackground1, border: `1px solid ${tokens.colorPaletteRedBorder1}`, borderRadius: tokens.borderRadiusMedium, color: tokens.colorPaletteRedForeground1 }}>
                        <Text weight="bold">Warning:</Text> {result.unallocated.length} parts could not be nested (Too long?).
                    </div>
                )}
            </div>
        </Card>
    )
}

function BarVisualizer({ totalLength, parts, waste, type }: {
    totalLength: number,
    parts: { length: number }[],
    waste: number,
    type: 'stock' | 'new'
}) {
    const styles = useStyles();
    const partColor = type === 'stock' ? tokens.colorPaletteBlueBackground2 : tokens.colorPaletteRedBackground2;

    return (
        <div className={styles.barContainer}>
            {parts.map((p, i) => (
                <div
                    key={i}
                    className={styles.barItem}
                    style={{
                        width: `${(p.length / totalLength) * 100}%`,
                        backgroundColor: partColor
                    }}
                    title={`Part: ${p.length}mm`}
                >
                    {p.length}
                </div>
            ))}
            {waste > 0 && (
                <div
                    className={styles.wasteItem}
                    style={{
                        width: `${(waste / totalLength) * 100}%`
                    }}
                    title={`Waste: ${waste}mm`}
                >
                    {Math.round(waste)}
                </div>
            )}
        </div>
    )
}
