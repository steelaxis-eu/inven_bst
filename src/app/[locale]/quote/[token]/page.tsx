'use client'

import { useEffect, useState } from 'react'
import {
    Card,
    Button,
    Input,
    Label,
    Textarea,
    Spinner,
    Text,
    Title3
} from "@fluentui/react-components"
import { CheckmarkCircleRegular, ErrorCircleRegular } from "@fluentui/react-icons"
import { toast } from "sonner"
import { getWorkOrderByQuoteToken, submitSupplierQuote } from '@/app/actions/workorders'

export default function QuoteSubmissionPage({ params }: { params: { token: string, locale: string } }) {
    const [wo, setWo] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState('')

    const [form, setForm] = useState({
        companyName: '',
        email: '',
        pricing: '',
        leadTime: '',
        notes: ''
    })

    useEffect(() => {
        async function fetchWO() {
            try {
                const data = await getWorkOrderByQuoteToken(params.token)
                if (!data) {
                    setError('Invalid or expired quote link.')
                } else {
                    setWo(data)
                }
            } catch (e: any) {
                setError('Failed to load quote details.')
            } finally {
                setLoading(false)
            }
        }
        fetchWO()
    }, [params.token])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.companyName || !form.email || !form.pricing || !form.leadTime) {
            toast.error('Please fill in all required fields.')
            return
        }

        setSubmitting(true)
        try {
            const res = await submitSupplierQuote(params.token, form)
            if (res.success) {
                setSubmitted(true)
                toast.success('Quote submitted successfully!')
            } else {
                toast.error(res.error || 'Failed to submit quote.')
            }
        } catch (e) {
            toast.error('An unexpected error occurred.')
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#faf9f8' }}>
                <Spinner size="huge" label="Loading quote..." />
            </div>
        )
    }

    if (error) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#faf9f8', padding: '16px' }}>
                <Card style={{ padding: '24px', maxWidth: '400px', width: '100%', textAlign: 'center', borderTop: '4px solid #d13438' }}>
                    <ErrorCircleRegular style={{ fontSize: '48px', color: '#d13438', marginBottom: '16px' }} />
                    <Title3>Error</Title3>
                    <Text style={{ marginTop: '8px' }}>{error}</Text>
                </Card>
            </div>
        )
    }

    if (submitted) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#faf9f8', padding: '16px' }}>
                <Card style={{ padding: '40px', maxWidth: '450px', width: '100%', textAlign: 'center' }}>
                    <CheckmarkCircleRegular style={{ fontSize: '64px', color: '#107c10', marginBottom: '16px' }} />
                    <Title3>Quote Submitted</Title3>
                    <Text style={{ marginTop: '16px', display: 'block' }}>Thank you for your submission. The team has been notified and will review your quote shortly.</Text>
                </Card>
            </div>
        )
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#faf9f8', padding: '48px 16px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '32px' }}>

                <div style={{ textAlign: 'center' }}>
                    <Title3 style={{ fontSize: '28px' }}>Request for Quote</Title3>
                    <Text style={{ display: 'block', marginTop: '8px', color: '#605e5c' }}>
                        Please review the requirements and submit your best offer.
                    </Text>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
                    {/* Left Column: Requirements */}
                    <Card style={{ padding: '24px', height: 'fit-content' }}>
                        <Title3 style={{ marginBottom: '16px', borderBottom: '1px solid #edebe9', paddingBottom: '12px' }}>Project Details</Title3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                                <Text weight="semibold" style={{ marginRight: '8px' }}>Project:</Text>
                                <Text>{wo.project?.name} ({wo.project?.projectNumber})</Text>
                            </div>
                            <div>
                                <Text weight="semibold" style={{ marginRight: '8px' }}>Work Order:</Text>
                                <Text>{wo.workOrderNumber}</Text>
                            </div>
                            <div>
                                <Text weight="semibold" style={{ marginRight: '8px' }}>Title:</Text>
                                <Text>{wo.title}</Text>
                            </div>
                            {wo.description && (
                                <div style={{ marginTop: '8px' }}>
                                    <Text weight="semibold" style={{ display: 'block', marginBottom: '4px' }}>Description:</Text>
                                    <Text style={{ whiteSpace: 'pre-wrap' }}>{wo.description}</Text>
                                </div>
                            )}

                            <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #edebe9' }}>
                                <Text weight="semibold" style={{ marginBottom: '12px', display: 'block', fontSize: '16px' }}>Required Items</Text>
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {wo.items?.map((item: any) => {
                                        let name = 'Unknown Item'
                                        if (item.piece?.part) {
                                            name = `${item.piece.part.profile} ${item.piece.part.grade} - L:${item.piece.length}mm`
                                        } else if (item.platePart) {
                                            name = `${item.platePart.thickness}mm ${item.platePart.grade} Plate - ${item.platePart.partNumber}`
                                        }
                                        return (
                                            <li key={item.id} style={{ backgroundColor: '#f3f2f1', padding: '12px', borderRadius: '4px', border: '1px solid #edebe9' }}>
                                                <Text weight="semibold" style={{ display: 'block' }}>{name}</Text>
                                                {item.notes && <Text size={200} style={{ color: '#605e5c', display: 'block', marginTop: '4px' }}>{item.notes}</Text>}
                                            </li>
                                        )
                                    })}
                                </ul>
                            </div>
                        </div>
                    </Card>

                    {/* Right Column: Submission Form */}
                    <Card style={{ padding: '24px' }}>
                        <Title3 style={{ marginBottom: '24px', borderBottom: '1px solid #edebe9', paddingBottom: '12px' }}>Your Offer</Title3>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <Label htmlFor="companyName" required>Company Name</Label>
                                <Input
                                    id="companyName"
                                    required
                                    placeholder="e.g. Acme Corp"
                                    value={form.companyName}
                                    onChange={(e, data) => setForm({ ...form, companyName: data.value })}
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <Label htmlFor="email" required>Contact Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    required
                                    placeholder="sales@acmecorp.com"
                                    value={form.email}
                                    onChange={(e, data) => setForm({ ...form, email: data.value })}
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <Label htmlFor="pricing" required>Total Price (or breakdown)</Label>
                                <Textarea
                                    id="pricing"
                                    required
                                    placeholder="e.g. $1,250.00 total including delivery"
                                    style={{ minHeight: '80px' }}
                                    value={form.pricing}
                                    onChange={(e, data) => setForm({ ...form, pricing: data.value })}
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <Label htmlFor="leadTime" required>Estimated Lead Time</Label>
                                <Input
                                    id="leadTime"
                                    required
                                    placeholder="e.g. 5-7 business days"
                                    value={form.leadTime}
                                    onChange={(e, data) => setForm({ ...form, leadTime: data.value })}
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <Label htmlFor="notes">Additional Notes</Label>
                                <Textarea
                                    id="notes"
                                    placeholder="Any clarifications or exclusions..."
                                    style={{ minHeight: '80px' }}
                                    value={form.notes}
                                    onChange={(e, data) => setForm({ ...form, notes: data.value })}
                                />
                            </div>

                            <Button appearance="primary" type="submit" disabled={submitting} style={{ marginTop: '8px' }}>
                                {submitting ? 'Submitting...' : 'Submit Quote'}
                            </Button>
                        </form>
                    </Card>
                </div>
            </div>
        </div>
    )
}
