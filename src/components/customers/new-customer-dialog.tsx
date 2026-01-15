'use client'

import { useState } from 'react'
import {
    Button,
    Dialog,
    DialogTrigger,
    DialogSurface,
    DialogTitle,
    DialogBody,
    DialogContent,
    DialogActions,
    Input,
    Label,
    Textarea,
    makeStyles,
    tokens
} from "@fluentui/react-components"
import { AddRegular, PersonAddRegular } from "@fluentui/react-icons"
import { createCustomer } from "@/app/actions/customers"
import { toast } from "sonner"

const useStyles = makeStyles({
    content: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
    },
    gridTwo: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
    }
})

export function NewCustomerDialog() {
    const styles = useStyles()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState({
        companyName: '',
        contactName: '',
        contactEmail: '',
        contactPhone: '',
        address: ''
    })

    const handleSubmit = async () => {
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
        <Dialog open={open} onOpenChange={(e, data) => setOpen(data.open)}>
            <DialogTrigger disableButtonEnhancement>
                <Button icon={<PersonAddRegular />}>Add Customer</Button>
            </DialogTrigger>
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>Add New Customer</DialogTitle>
                    <DialogContent className={styles.content}>
                        <div>
                            <Label required>Company Name</Label>
                            <Input
                                value={data.companyName}
                                onChange={(e, d) => setData({ ...data, companyName: d.value })}
                                style={{ width: '100%' }}
                            />
                        </div>
                        <div className={styles.gridTwo}>
                            <div>
                                <Label>Contact Name</Label>
                                <Input
                                    value={data.contactName}
                                    onChange={(e, d) => setData({ ...data, contactName: d.value })}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div>
                                <Label>Email</Label>
                                <Input
                                    type="email"
                                    value={data.contactEmail}
                                    onChange={(e, d) => setData({ ...data, contactEmail: d.value })}
                                    style={{ width: '100%' }}
                                />
                            </div>
                        </div>
                        <div>
                            <Label>Phone</Label>
                            <Input
                                value={data.contactPhone}
                                onChange={(e, d) => setData({ ...data, contactPhone: d.value })}
                                style={{ width: '100%' }}
                            />
                        </div>
                        <div>
                            <Label>Address</Label>
                            <Textarea
                                value={data.address}
                                onChange={(e, d) => setData({ ...data, address: d.value })}
                                style={{ width: '100%' }}
                            />
                        </div>
                    </DialogContent>
                    <DialogActions>
                        <Button appearance="secondary" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button appearance="primary" onClick={handleSubmit} disabled={loading}>
                            {loading ? "Creating..." : "Create Customer"}
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    )
}
