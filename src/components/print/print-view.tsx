'use client'

import React from 'react'
import { Button } from "@fluentui/react-components"
import { PrintRegular, ArrowLeftRegular } from '@fluentui/react-icons'
import Link from 'next/link'
import { format } from 'date-fns'

interface PrintViewProps {
    workOrder: any // Typed as any for flexibility, ideally inferred from Prisma
}

function CuttingPlanVisualizer({ plans }: { plans: any[] }) {
    if (!plans || plans.length === 0) return null

    return (
        <div className="mt-8 space-y-8">
            <h3 className="font-bold text-lg uppercase border-b-2 border-black pb-1">Visual Cutting Plan (How to Cut)</h3>
            {plans.map((p, pIdx) => {
                if (p.type !== 'profile' || !p.result) return null

                // Group identical patterns
                const patterns: any[] = []

                // New Stock Patterns
                const newPatterns: Record<string, { qty: number, length: number, parts: any[] }> = {}
                p.result.newStockNeeded.forEach((ns: any) => {
                    const partsStr = ns.parts.map((part: any) => `${part.partNumber}@${part.length}`).join('|')
                    const key = `${ns.length}#${partsStr}`
                    if (!newPatterns[key]) newPatterns[key] = { qty: 0, length: ns.length, parts: ns.parts }
                    newPatterns[key].qty++
                })
                Object.values(newPatterns).forEach(pat => patterns.push({ ...pat, source: 'New Stock' }))

                // Stock Used Patterns
                const stockPatterns: Record<string, { qty: number, length: number, parts: any[] }> = {}
                p.result.stockUsed.forEach((su: any) => {
                    const partsStr = su.parts.map((part: any) => `${part.partNumber}@${part.length}`).join('|')
                    const key = `SU#${su.originalLength}#${partsStr}`
                    if (!stockPatterns[key]) stockPatterns[key] = { qty: 0, length: su.originalLength, parts: su.parts }
                    stockPatterns[key].qty++
                })
                Object.values(stockPatterns).forEach(pat => patterns.push({ ...pat, source: 'Inventory' }))

                return (
                    <div key={pIdx} className="space-y-4">
                        <div className="flex justify-between items-end border-b border-gray-200 pb-1">
                            <span className="font-bold text-blue-800">{p.profile} ({p.grade})</span>
                            <span className="text-xs text-gray-500 uppercase">Efficiency: {(p.result.efficiency * 100).toFixed(1)}%</span>
                        </div>

                        <div className="space-y-6">
                            {patterns.map((pat, patIdx) => (
                                <div key={patIdx} className="space-y-2">
                                    <div className="flex justify-between text-xs font-semibold">
                                        <span>{pat.qty}x {pat.source} Bar ({pat.length}mm)</span>
                                    </div>

                                    {/* The Visual Bar */}
                                    <div className="relative w-full h-10 bg-gray-100 flex items-center border border-gray-300 rounded overflow-hidden">
                                        {pat.parts.map((seg: any, sIdx: number) => {
                                            const width = (seg.length / pat.length) * 100
                                            return (
                                                <div
                                                    key={sIdx}
                                                    className="h-full border-r border-black flex flex-col justify-center items-center overflow-hidden bg-white hover:bg-gray-50 transition-colors"
                                                    style={{ width: `${width}%` }}
                                                >
                                                    <span className="text-[10px] font-bold leading-none truncate w-full text-center px-1">
                                                        {seg.partNumber}
                                                    </span>
                                                    <span className="text-[9px] text-gray-600 leading-none">
                                                        {seg.length}
                                                    </span>
                                                </div>
                                            )
                                        })}
                                        {/* Remnant / Waste */}
                                        <div className="h-full bg-gray-200/50 flex flex-col justify-center items-center flex-1">
                                            <span className="text-[8px] text-gray-400 font-bold uppercase">Waste</span>
                                        </div>
                                    </div>

                                    {/* Dimension Labels (Absolute positioning of tick marks below the bar) */}
                                    <div className="relative w-full h-4 flex text-[8px] text-gray-500">
                                        {(() => {
                                            let currentPos = 0
                                            return pat.parts.map((seg: any, sIdx: number) => {
                                                currentPos += seg.length
                                                const left = (currentPos / pat.length) * 100
                                                return (
                                                    <div
                                                        key={sIdx}
                                                        className="absolute top-0 border-l border-gray-400 h-2"
                                                        style={{ left: `${left}%` }}
                                                    >
                                                        <span className="absolute -left-1 top-2">{currentPos}</span>
                                                    </div>
                                                )
                                            })
                                        })()}
                                        <div className="absolute top-0 right-0 border-r border-gray-400 h-2">
                                            <span className="absolute -right-1 top-2">{pat.length}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

export function PrintView({ workOrder }: PrintViewProps) {

    const handlePrint = () => {
        window.print()
    }

    return (
        <div className="min-h-screen bg-white text-black p-0 md:p-8">
            {/* No-Print Controls */}
            <div className="print:hidden mb-6 flex justify-between items-center bg-gray-100 p-4 rounded-lg shadow-sm">
                <Link href={`/projects/${workOrder.projectId}`}>
                    <Button appearance="outline" icon={<ArrowLeftRegular />}>
                        Back to Project
                    </Button>
                </Link>
                <Button appearance="primary" onClick={handlePrint} icon={<PrintRegular />}>
                    Print Work Order
                </Button>
            </div>

            {/* Printable Content - Keeping Tailwind classes for print layout as they are not Shadcn dependencies */}
            <div className="max-w-[210mm] mx-auto bg-white print:w-full print:max-w-none">
                {/* Header */}
                <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-bold uppercase tracking-wider">{workOrder.type} Work Order</h1>
                        <div className="text-lg font-mono mt-1">{workOrder.workOrderNumber}</div>
                    </div>
                    <div className="text-right">
                        <div className="font-bold text-xl">{workOrder.project.name}</div>
                        <div className="text-sm text-gray-600">Project #{workOrder.project.projectNumber}</div>
                        <div className="text-sm mt-2">Date: {format(new Date(), 'dd MMM yyyy')}</div>
                    </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
                    <div>
                        <h3 className="font-bold border-b border-gray-300 mb-2 uppercase text-xs">Details</h3>
                        <div className="grid grid-cols-[100px_1fr] gap-1">
                            <span className="text-gray-500">Status:</span>
                            <span className="font-semibold">{workOrder.status}</span>
                            <span className="text-gray-500">Priority:</span>
                            <span className="font-semibold">{workOrder.priority}</span>
                            <span className="text-gray-500">Suggested Date:</span>
                            <span>{workOrder.scheduledDate ? format(new Date(workOrder.scheduledDate), 'dd MMM yyyy') : '-'}</span>
                        </div>
                    </div>
                    <div>
                        <h3 className="font-bold border-b border-gray-300 mb-2 uppercase text-xs">Notes</h3>
                        <div className="italic text-gray-700 whitespace-pre-wrap">
                            {workOrder.notes || "No notes provided."}
                        </div>
                    </div>
                </div>

                {/* Items Table */}
                <div className="mb-8">
                    <h3 className="font-bold text-lg mb-4 uppercase">Items List</h3>
                    <table className="w-full text-sm text-left border-collapse">
                        <thead>
                            <tr className="border-b-2 border-black">
                                <th className="py-2">Item / Part</th>
                                <th className="py-2">Description / Dimensions</th>
                                <th className="py-2 text-center">Qty</th>
                                {workOrder.type === 'CUTTING' && (
                                    <>
                                        <th className="py-2">Material</th>
                                        <th className="py-2">Cut Length</th>
                                    </>
                                )}
                                <th className="py-2 w-[100px]">Check</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(() => {
                                const groupedItems: Record<string, {
                                    partNumber: string,
                                    name: string,
                                    description: string,
                                    qty: number,
                                    material: string,
                                    materialDetails: string,
                                    cutLength: number,
                                    grade: string
                                }> = {}

                                workOrder.items.forEach((item: any) => {
                                    const piece = item.piece
                                    const part = piece?.part
                                    const profile = part?.profile
                                    const assembly = item.assembly
                                    const platePart = item.platePart

                                    let key = '';
                                    let data: any = {};

                                    if (part) {
                                        key = `part-${part.partNumber}-${part.length}-${profile?.type}-${profile?.dimensions}-${part.grade?.name}`
                                        data = {
                                            partNumber: part.partNumber,
                                            name: part.name,
                                            description: part.description,
                                            material: profile?.type,
                                            materialDetails: profile?.dimensions,
                                            cutLength: part.length,
                                            grade: part.grade?.name
                                        }
                                    } else if (assembly) {
                                        key = `assembly-${assembly.assemblyNumber}`
                                        data = {
                                            partNumber: assembly.assemblyNumber,
                                            name: assembly.name,
                                            description: '',
                                            material: 'Assembly',
                                            materialDetails: '',
                                            cutLength: 0,
                                            grade: ''
                                        }
                                    } else if (platePart) {
                                        key = `plate-${platePart.partNumber}`
                                        data = {
                                            partNumber: platePart.partNumber,
                                            name: '',
                                            description: platePart.description,
                                            material: 'Plate',
                                            materialDetails: platePart.material,
                                            cutLength: 0,
                                            grade: ''
                                        }
                                    } else {
                                        key = `other-${item.id}`
                                        data = {
                                            partNumber: '?',
                                            name: item.description || 'Unknown',
                                            description: '',
                                            material: '',
                                            materialDetails: '',
                                            cutLength: 0,
                                            grade: ''
                                        }
                                    }

                                    if (!groupedItems[key]) {
                                        groupedItems[key] = { ...data, qty: 0 }
                                    }
                                    groupedItems[key].qty++
                                })

                                return Object.values(groupedItems).map((group, idx) => (
                                    <tr key={idx} className="border-b border-gray-200 break-inside-avoid">
                                        <td className="py-3 font-mono">
                                            {group.partNumber}
                                        </td>
                                        <td className="py-3">
                                            <div className="font-semibold">{group.name}</div>
                                            {group.description && <div className="text-xs text-gray-500">{group.description}</div>}
                                        </td>
                                        <td className="py-3 text-center">{group.qty}</td>

                                        {/* Dynamic Columns based on Type */}
                                        {workOrder.type === 'CUTTING' && (
                                            <>
                                                <td className="py-3">
                                                    {group.material} {group.materialDetails} <br />
                                                    <span className="text-xs text-gray-500">{group.grade}</span>
                                                </td>
                                                <td className="py-3 font-mono">
                                                    {group.cutLength > 0 ? `${group.cutLength} mm` : '-'}
                                                </td>
                                            </>
                                        )}

                                        <td className="py-3">
                                            <div className="w-6 h-6 border-2 border-gray-400 rounded-sm"></div>
                                        </td>
                                    </tr>
                                ))
                            })()}
                        </tbody>
                    </table>
                </div>

                {/* Cutting Plan Visualization */}
                {workOrder.type === 'CUTTING' && workOrder.metadata?.plans && (
                    <CuttingPlanVisualizer plans={workOrder.metadata.plans} />
                )}

                {/* Footer Signatures */}
                <div className="mt-16 grid grid-cols-2 gap-16 break-inside-avoid">
                    <div className="border-t border-black pt-2">
                        <div className="font-bold text-sm uppercase">Operator Signature</div>
                    </div>
                    <div className="border-t border-black pt-2">
                        <div className="font-bold text-sm uppercase">Supervisor Signature</div>
                    </div>
                </div>

                <div className="text-center text-xs text-gray-400 mt-12 print:fixed print:bottom-4 print:left-0 print:w-full">
                    Generated by SteelAxis - {new Date().toLocaleString()}
                </div>
            </div>
        </div>
    )
}
