'use client'

import React from 'react'
import { Button } from "@fluentui/react-components"
import { PrintRegular, ArrowLeftRegular } from '@fluentui/react-icons'
import Link from 'next/link'
import { format } from 'date-fns'

interface PrintViewProps {
    workOrder: any // Typed as any for flexibility, ideally inferred from Prisma
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
                            {workOrder.items.map((item: any, idx: number) => {
                                const piece = item.piece
                                const part = piece?.part
                                const profile = part?.profile

                                return (
                                    <tr key={item.id} className="border-b border-gray-200 break-inside-avoid">
                                        <td className="py-3 font-mono">
                                            {part?.partNumber || item.description || `Item #${idx + 1}`}
                                        </td>
                                        <td className="py-3">
                                            {part ? (
                                                <>
                                                    <div className="font-semibold">{part.name}</div>
                                                </>
                                            ) : (
                                                item.description
                                            )}
                                        </td>
                                        <td className="py-3 text-center">1</td>

                                        {/* Dynamic Columns based on Type */}
                                        {workOrder.type === 'CUTTING' && (
                                            <>
                                                <td className="py-3">
                                                    {profile?.type} {profile?.dimensions} <br />
                                                    <span className="text-xs text-gray-500">{part?.grade?.name}</span>
                                                </td>
                                                <td className="py-3 font-mono">
                                                    {part?.length} mm
                                                </td>
                                            </>
                                        )}

                                        <td className="py-3">
                                            <div className="w-6 h-6 border-2 border-gray-400 rounded-sm"></div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

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
