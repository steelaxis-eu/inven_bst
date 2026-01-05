'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

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
        parts: { partId: string, length: number }[] // This might be grouped
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
}

export function NestingVisualizer({ plan }: NestingVisualizerProps) {
    const { profile, grade, result } = plan

    return (
        <Card className="mb-4 text-xs">
            <CardHeader className="py-2 px-4 bg-muted/50 rounded-t-lg">
                <div className="flex justify-between items-center">
                    <span className="font-semibold">{profile} - {grade}</span>
                    <Badge variant={result.efficiency > 0.85 ? "default" : "secondary"}>
                        Eff: {Math.round(result.efficiency * 100)}%
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">

                {/* 1. EXISTING STOCK USAGE */}
                {result.stockUsed.length > 0 && (
                    <div>
                        <h4 className="font-semibold mb-2 text-muted-foreground flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            Using {result.stockUsed.length} Existing Items (Stock/Remnants)
                        </h4>
                        <div className="space-y-2">
                            {result.stockUsed.map((stock, idx) => (
                                <div key={stock.stockId + idx} className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-muted-foreground">
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
                        <h4 className="font-semibold mb-2 text-muted-foreground flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                            Buy {result.newStockNeeded.reduce((s, x) => s + x.quantity, 0)} New Bars
                        </h4>
                        <div className="space-y-2">
                            {result.newStockNeeded.map((stock, idx) => (
                                <div key={idx} className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-muted-foreground">
                                        <span>New Bar ({stock.quantity}x)</span>
                                        <span>{stock.length}mm</span>
                                    </div>
                                    {/* Visualize just one example bar for this group */}
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
                    <div className="p-2 bg-red-100 dark:bg-red-900/30 border border-red-200 rounded text-red-600">
                        <strong>Warning:</strong> {result.unallocated.length} parts could not be nested (Too long?).
                    </div>
                )}

            </CardContent>
        </Card>
    )
}

function BarVisualizer({ totalLength, parts, waste, type }: {
    totalLength: number,
    parts: { length: number }[], // Reduced interface
    waste: number,
    type: 'stock' | 'new'
}) {
    // Determine colors
    const partColor = type === 'stock' ? 'bg-blue-500' : 'bg-red-500'
    const wasteColor = 'bg-gray-200 dark:bg-gray-700 repeating-linear-gradient(45deg,transparent,transparent_5px,#00000010_5px,#00000010_10px)'

    return (
        <div className="h-6 w-full bg-muted rounded overflow-hidden flex border border-border relative">
            {parts.map((p, i) => (
                <div
                    key={i}
                    className={`h-full ${partColor} border-r border-white/20 flex items-center justify-center text-[9px] text-white font-medium`}
                    style={{ width: `${(p.length / totalLength) * 100}%` }}
                    title={`Part: ${p.length}mm`}
                >
                    {p.length}
                </div>
            ))}
            {waste > 0 && (
                <div
                    className="h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[9px] text-muted-foreground"
                    style={{
                        width: `${(waste / totalLength) * 100}%`,
                        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.05) 5px, rgba(0,0,0,0.05) 10px)'
                    }}
                    title={`Waste: ${waste}mm`}
                >
                    {Math.round(waste)}
                </div>
            )}
        </div>
    )
}
