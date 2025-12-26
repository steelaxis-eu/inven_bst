'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createCustomer } from "@/app/actions/customers"
import { toast } from "sonner"
import { Plus } from "lucide-react"

export function NewCustomerDialog() {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState({
        companyName: '',
        contactName: '',
        contactEmail: '',
        contactPhone: '',
        address: ''
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!data.companyName) return

        setLoading(true)
        try {
            const res = await createCustomer(data)
            if (res.success) {
                toast.success('Customer created successfully')
                setOpen(false)
                setData({ companyName: '', contactName: '', contactEmail: '', contactPhone: '', address: '' })
            } else {
                toast.error(res.error || 'Failed to create customer')
            }
        } catch (e) {
            toast.error('An error occurred')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Add Customer</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Add New Customer</DialogTitle>
                        <DialogDescription>
                            Create a new customer profile.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="companyName">Company Name *</Label>
                            <Input
                                id="companyName"
                                value={data.companyName}
                                onChange={e => setData({ ...data, companyName: e.target.value })}
                                required
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="contactName">Contact Name</Label>
                                <Input
                                    id="contactName"
                                    value={data.contactName}
                                    onChange={e => setData({ ...data, contactName: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="contactEmail">Email</Label>
                                <Input
                                    id="contactEmail"
                                    type="email"
                                    value={data.contactEmail}
                                    onChange={e => setData({ ...data, contactEmail: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="contactPhone">Phone</Label>
                            <Input
                                id="contactPhone"
                                value={data.contactPhone}
                                onChange={e => setData({ ...data, contactPhone: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="address">Address</Label>
                            <Textarea
                                id="address"
                                value={data.address}
                                onChange={e => setData({ ...data, address: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Creating..." : "Create Customer"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
