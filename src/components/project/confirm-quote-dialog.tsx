'use client'

import { useState, useEffect, useRef } from 'react'
import {
    Dialog,
    DialogTrigger,
    DialogSurface,
    DialogTitle,
    DialogBody,
    DialogContent,
    DialogActions,
    Button,
    Label,
    Input,
    Textarea,
    Spinner,
    Text,
    Title3
} from "@fluentui/react-components"
import { CheckmarkRegular, SendRegular } from "@fluentui/react-icons"
import { toast } from 'sonner'
import { sendSupplierConfirmation, generateConfirmationEmail } from '@/app/actions/emails'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

interface ConfirmQuoteDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    quote: any
    workOrder: any
}

export function ConfirmQuoteDialog({
    open,
    onOpenChange,
    quote,
    workOrder
}: ConfirmQuoteDialogProps) {
    const [loading, setLoading] = useState(false)
    const [body, setBody] = useState('')
    const [subject, setSubject] = useState('')
    const poRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (open && quote && workOrder) {
            setSubject(`Purchase Order - ${workOrder.workOrderNumber} - ${workOrder.project?.name}`)
            generateConfirmationEmail(quote).then(text => setBody(text))
        }
    }, [open, quote, workOrder])

    const generatePdfBase64 = async (): Promise<string | undefined> => {
        if (!poRef.current) return undefined

        try {
            // Need to ensure the hidden element is briefly shown or rendered clearly for html2canvas
            // html2canvas sometimes struggles with completely hidden distinct elements.
            // Using absolute positioned element out of viewport is generally safe.
            const canvas = await html2canvas(poRef.current, { scale: 2, useCORS: true })
            const imgData = canvas.toDataURL('image/jpeg', 0.9)

            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'px',
                format: [canvas.width / 2, canvas.height / 2]
            })

            pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width / 2, canvas.height / 2)

            // Return base64 string directly (it includes data:application/pdf;base64,... but actions will strip it)
            return pdf.output('dataurlstring')
        } catch (e) {
            console.error("PDF gen error", e)
            return undefined
        }
    }

    const handleSend = async () => {
        setLoading(true)
        try {
            toast.info('Generating PDF...')
            const pdfBase64 = await generatePdfBase64()

            if (!pdfBase64) {
                toast.error('Failed to generate PDF attachment')
                setLoading(false)
                return
            }

            toast.info('Sending Email...')
            const res = await sendSupplierConfirmation(
                quote.email,
                subject,
                body,
                pdfBase64
            )

            if (res.success) {
                toast.success('Confirmation email sent successfully!')
                onOpenChange(false)
            } else {
                toast.error(res.error || 'Failed to send confirmation')
            }
        } catch (e: any) {
            toast.error(e.message || 'Error occurred during confirmation')
        } finally {
            setLoading(false)
        }
    }

    if (!quote || !workOrder) return null

    return (
        <>
            <Dialog open={open} onOpenChange={(e, data) => onOpenChange(data.open)}>
                <DialogSurface>
                    <DialogBody>
                        <DialogTitle>Confirm Quote & Send PO</DialogTitle>
                        <DialogContent>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                                <Text>
                                    Review the email template below. A PDF Purchase Order will be automatically generated and attached to this email.
                                </Text>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <Label>To</Label>
                                    <Input value={quote.email} readOnly />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <Label>Subject</Label>
                                    <Input value={subject} onChange={(e, d) => setSubject(d.value)} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <Label>Body</Label>
                                    <Textarea value={body} onChange={(e, d) => setBody(d.value)} style={{ minHeight: '200px' }} />
                                </div>
                            </div>
                        </DialogContent>
                        <DialogActions>
                            <Button appearance="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
                                Cancel
                            </Button>
                            <Button appearance="primary" icon={loading ? <Spinner size="tiny" /> : <SendRegular />} onClick={handleSend} disabled={loading}>
                                {loading ? 'Sending...' : 'Send Confirmation'}
                            </Button>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>

            {/* Hidden DOM element to construct the PDF */}
            <div style={{ position: 'absolute', top: '-10000px', left: '-10000px' }}>
                <div ref={poRef} style={{ width: '800px', backgroundColor: 'white', padding: '40px', color: 'black', fontFamily: 'sans-serif' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid black', paddingBottom: '20px', marginBottom: '20px' }}>
                        <div>
                            <h1 style={{ margin: 0, fontSize: '28px' }}>PURCHASE ORDER</h1>
                            <p style={{ margin: '5px 0 0 0', color: '#666' }}>Date: {new Date().toLocaleDateString()}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <h2 style={{ margin: 0, fontSize: '20px' }}>{workOrder.project?.name}</h2>
                            <p style={{ margin: '5px 0 0 0', fontWeight: 'bold' }}>WO: {workOrder.workOrderNumber}</p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
                        <div style={{ width: '45%' }}>
                            <h3 style={{ fontSize: '14px', color: '#666', borderBottom: '1px solid #ccc', paddingBottom: '5px', marginBottom: '10px' }}>VENDOR</h3>
                            <p style={{ margin: '2px 0', fontWeight: 'bold' }}>{quote.companyName}</p>
                            <p style={{ margin: '2px 0' }}>{quote.email}</p>
                        </div>
                        <div style={{ width: '45%' }}>
                            <h3 style={{ fontSize: '14px', color: '#666', borderBottom: '1px solid #ccc', paddingBottom: '5px', marginBottom: '10px' }}>SHIP TO</h3>
                            <p style={{ margin: '2px 0', fontWeight: 'bold' }}>Internal Production Address</p>
                            <p style={{ margin: '2px 0' }}>Factory floor</p>
                        </div>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '40px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f5f5f5' }}>
                                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Req Items</th>
                                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {workOrder.items?.map((item: any, idx: number) => {
                                let name = 'Unknown Item'
                                if (item.piece?.part) {
                                    name = `${item.piece.part.profile} ${item.piece.part.grade} - L:${item.piece.length}mm`
                                } else if (item.platePart) {
                                    name = `${item.platePart.thickness}mm ${item.platePart.grade} Plate - ${item.platePart.partNumber}`
                                }
                                return (
                                    <tr key={idx}>
                                        <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{name}</td>
                                        <td style={{ padding: '10px', borderBottom: '1px solid #eee', color: '#666' }}>{item.notes || '-'}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>

                    <div style={{ borderTop: '2px solid black', paddingTop: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <span style={{ fontWeight: 'bold' }}>Lead Time:</span>
                            <span>{quote.leadTime}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <span style={{ fontWeight: 'bold' }}>Supplier Notes:</span>
                            <span>{quote.notes || 'N/A'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#f9f9f9', padding: '15px', marginTop: '20px' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '18px' }}>TOTAL PRICE</span>
                            <span style={{ fontWeight: 'bold', fontSize: '18px' }}>{quote.pricing}</span>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
