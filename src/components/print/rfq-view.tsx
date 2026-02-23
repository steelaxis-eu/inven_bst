'use client'

import React from 'react'
import { Button } from "@fluentui/react-components"
import { PrintRegular, ArrowLeftRegular } from '@fluentui/react-icons'
import Link from 'next/link'
import { format } from 'date-fns'

interface RfqViewProps {
    workOrder: any // Typed as any for flexibility, ideally inferred from Prisma
}

export function RfqView({ workOrder }: RfqViewProps) {
    const handlePrint = () => {
        window.print()
    }

    const plans = workOrder.metadata?.plans || []

    // Extract required materials from optimization plans
    const requiredMaterials: Record<string, { profile: string, grade: string, length: number, qty: number }> = {}

    plans.forEach((p: any) => {
        if (p.type === 'profile' && p.result?.newStockNeeded) {
            p.result.newStockNeeded.forEach((ns: any) => {
                const key = `${p.profile}-${p.grade}-${ns.length}`
                if (!requiredMaterials[key]) {
                    requiredMaterials[key] = {
                        profile: p.profile,
                        grade: p.grade,
                        length: ns.length,
                        qty: 0
                    }
                }
                requiredMaterials[key].qty += ns.quantity
            })
        }
    })

    const materialList = Object.values(requiredMaterials)

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
                    Save PDF / Print RFQ
                </Button>
            </div>

            {/* Printable Content - Keeping Tailwind classes for print layout */}
            <div className="max-w-[210mm] mx-auto bg-white print:w-full print:max-w-none">
                {/* Header */}
                <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-bold uppercase tracking-wider">Request for Quotation</h1>
                        <div className="text-lg font-mono mt-1">Ref: {workOrder.workOrderNumber}</div>
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
                        <div className="grid grid-cols-[120px_1fr] gap-1">
                            <span className="text-gray-500">Requested By:</span>
                            <span className="font-semibold">SteelAxis Buyer</span>
                            <span className="text-gray-500">Required Date:</span>
                            <span>{workOrder.scheduledDate ? format(new Date(workOrder.scheduledDate), 'dd MMM yyyy') : 'ASAP'}</span>
                        </div>
                    </div>
                    <div>
                        <h3 className="font-bold border-b border-gray-300 mb-2 uppercase text-xs">Notes / Additional Info</h3>
                        <div className="italic text-gray-700 whitespace-pre-wrap">
                            Please provide pricing and availability for the items listed below.
                        </div>
                    </div>
                </div>

                {/* Items Table */}
                <div className="mb-8">
                    <h3 className="font-bold text-lg mb-4 uppercase">Material Requirements</h3>

                    {materialList.length > 0 ? (
                        <table className="w-full text-sm text-left border-collapse">
                            <thead>
                                <tr className="border-b-2 border-black">
                                    <th className="py-2 w-12 text-center">#</th>
                                    <th className="py-2">Profile / Material</th>
                                    <th className="py-2">Grade</th>
                                    <th className="py-2">Stock Length</th>
                                    <th className="py-2 text-center">Quantity</th>
                                </tr>
                            </thead>
                            <tbody>
                                {materialList.map((item, idx) => (
                                    <tr key={idx} className="border-b border-gray-200">
                                        <td className="py-3 text-center text-gray-500">{idx + 1}</td>
                                        <td className="py-3 font-semibold">{item.profile}</td>
                                        <td className="py-3 font-mono">{item.grade}</td>
                                        <td className="py-3">{item.length} mm ({item.length / 1000} m)</td>
                                        <td className="py-3 text-center font-bold text-lg">{item.qty}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="p-4 bg-gray-50 border border-gray-200 rounded text-gray-600 italic">
                            No structured material requirements found for this Request.
                            <br /><br />
                            <h4 className="font-bold not-italic">Notes:</h4>
                            <div className="whitespace-pre-wrap not-italic mt-2">{workOrder.notes || "None"}</div>
                        </div>
                    )}
                </div>

                {/* Footer Notes */}
                <div className="mt-16 border-t border-black pt-2 text-sm text-gray-600">
                    <p>Unless specified otherwise, all materials should be provided with standard mill certification.</p>
                </div>

                <div className="text-center text-xs text-gray-400 mt-12 print:fixed print:bottom-4 print:left-0 print:w-full">
                    Generated by SteelAxis - {new Date().toLocaleString()}
                </div>
            </div>
        </div>
    )
}
