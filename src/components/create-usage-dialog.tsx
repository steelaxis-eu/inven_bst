'use client'

import React, { useState } from 'react'
import {
    Dialog,
    DialogTrigger,
    DialogSurface,
    DialogTitle,
    DialogBody,
    DialogActions,
    DialogContent,
    Button,
    Input,
    Field,
    makeStyles,
    Dropdown,
    Option,
    Combobox,
    Table,
    TableHeader,
    TableRow,
    TableHeaderCell,
    TableBody,
    TableCell,
    tokens,
    shorthands,
    Badge,
    Spinner,
    Text,
    Label
} from "@fluentui/react-components";
import {
    AddRegular,
    SaveRegular,
    DeleteRegular,
    SearchRegular,
    CheckmarkCircleRegular,
    DismissCircleRegular
} from "@fluentui/react-icons";
import { toast } from "sonner"
import { getUsageItem, createUsage } from '@/app/actions/usage'
import { format } from "date-fns"

const useStyles = makeStyles({
    dialogContent: {
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        width: "95vw",
        maxWidth: "1200px",
        height: "90vh",
        "@media (min-width: 768px)": {
            minWidth: "600px", // Only enforce min-width on larger screens
        }
    },
    section: {
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        padding: "16px",
        backgroundColor: tokens.colorNeutralBackground2,
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
    },
    sectionTitle: {
        fontWeight: "bold",
        color: tokens.colorNeutralForeground2,
        textTransform: "uppercase",
        fontSize: "12px",
        borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
        paddingBottom: "8px",
        marginBottom: "8px",
    },
    row: {
        display: "flex",
        gap: "16px",
        alignItems: "flex-end",
        flexWrap: "wrap",
    },
    field: {
        display: "flex",
        flexDirection: "column",
        gap: "4px",
    },
    successText: {
        color: tokens.colorPaletteGreenForeground1,
        fontSize: "12px",
        display: "flex",
        alignItems: "center",
        gap: "4px",
        marginTop: "4px"
    },
    errorText: {
        color: tokens.colorPaletteRedForeground1,
        fontSize: "12px",
        marginTop: "4px"
    }
});

interface CreateUsageDialogProps {
    projects: any[]
    trigger?: React.ReactNode
}

export function CreateUsageDialog({ projects, trigger }: CreateUsageDialogProps) {
    const styles = useStyles();
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    // Global Header State
    const [globalProject, setGlobalProject] = useState('')
    const [dateStr, setDateStr] = useState(format(new Date(), 'yyyy-MM-dd'))

    // Lines
    const [lines, setLines] = useState<any[]>([])

    // Current Line Form
    const [current, setCurrent] = useState({
        query: '',
        usedLength: '',
        project: '',
    })
    const [fetchedItem, setFetchedItem] = useState<any>(null)
    const [lookupLoading, setLookupLoading] = useState(false)
    const [lookupError, setLookupError] = useState('')
    const [offcutType, setOffcutType] = useState<'REMNANT' | 'SCRAP'>('REMNANT')

    // Calculated for current line
    const remainingLength = fetchedItem ? fetchedItem.length - parseFloat(current.usedLength || '0') : 0
    const calculatedCost = fetchedItem ? (parseFloat(current.usedLength || '0') / 1000) * fetchedItem.costPerMeter : 0

    const handleLookup = async () => {
        if (!current.query) return
        setLookupLoading(true)
        setLookupError('')
        setFetchedItem(null)
        setOffcutType('REMNANT')

        try {
            const item = await getUsageItem(current.query)
            if (item) {
                setFetchedItem(item)
                if (!current.usedLength) setCurrent(prev => ({ ...prev, usedLength: item.length.toString() }))
            } else {
                setLookupError('Item not found')
            }
        } catch (e) {
            setLookupError('Lookup failed')
        } finally {
            setLookupLoading(false)
        }
    }

    const handleAddLine = () => {
        if (!fetchedItem) return
        const usedL = parseFloat(current.usedLength)
        if (isNaN(usedL) || usedL <= 0) {
            toast.error("Invalid used length")
            return
        }
        if (usedL > fetchedItem.length) {
            toast.error(`Max length ${fetchedItem.length}mm`)
            return
        }

        setLines([...lines, {
            _id: Math.random().toString(),
            item: fetchedItem,
            usedLength: usedL,
            cost: calculatedCost,
            project: current.project || globalProject,
            createRemnant: offcutType === 'REMNANT',
            status: offcutType
        }])

        // Reset
        setCurrent({ query: '', usedLength: '', project: '' })
        setFetchedItem(null)
        setLookupError('')
    }

    const handleRemoveLine = (idx: number) => {
        setLines(lines.filter((_, i) => i !== idx))
    }

    const submitUsage = async () => {
        if (lines.length === 0) return
        if (!globalProject && lines.some(l => !l.project)) {
            toast.error("Please select a project for all items")
            return
        }

        setLoading(true)
        try {
            const payload = lines.map(line => ({
                type: line.item.type,
                id: line.item.id,
                lengthUsed: line.usedLength,
                createRemnant: line.createRemnant,
                projectId: line.project || globalProject
            }))

            const res = await createUsage(
                globalProject,
                '',
                payload
            )

            if (res.success) {
                toast.success("Usage registered")
                setOpen(false)
                setLines([])
                setGlobalProject('')
                setFetchedItem(null)
            } else {
                toast.error((res as any).error)
            }
        } catch (e: any) {
            toast.error(e.message || "Failed to submit")
        } finally {
            setLoading(false)
        }
    }

    const totalCost = lines.reduce((acc, l) => acc + l.cost, 0)
    const projectOptions = projects.map(p => ({
        value: p.id,
        text: `${p.projectNumber} - ${p.name}`
    }));

    return (
        <Dialog open={open} onOpenChange={(e, data) => setOpen(data.open)}>
            <DialogTrigger disableButtonEnhancement>
                {React.isValidElement(trigger) ? trigger : <Button>{trigger || "Register Usage"}</Button>}
            </DialogTrigger>
            <DialogSurface className={styles.dialogContent}>
                <DialogBody>
                    <DialogTitle>Register Material Usage</DialogTitle>

                    {/* Header Controls */}
                    <div className={styles.section}>
                        <div className={styles.sectionTitle}>Global Settings</div>
                        <div className={styles.row}>
                            <Field label="Global Project" className={styles.field} style={{ minWidth: '300px' }}>
                                <Combobox
                                    value={projects.find(p => p.id === globalProject)?.name || (globalProject ? "Selected" : "")}
                                    onOptionSelect={(e, d) => setGlobalProject(d.optionValue || '')}
                                    placeholder="Select Project"
                                >
                                    {projectOptions.map(p => <Option key={p.value} value={p.value} text={p.text}>{p.text}</Option>)}
                                </Combobox>
                            </Field>
                            <Field label="Date" className={styles.field}>
                                <Input type="date" value={dateStr} onChange={(e, d) => setDateStr(d.value)} />
                            </Field>
                        </div>
                    </div>

                    {/* Input Line */}
                    <div className={styles.section}>
                        <div className={styles.sectionTitle}>Add Item</div>
                        <div className={styles.row}>
                            <div className={styles.field} style={{ flex: 2, minWidth: '250px' }}>
                                <Label>Item Lookup (Lot ID / Remnant ID)</Label>
                                <Input
                                    value={current.query}
                                    onChange={(e, d) => setCurrent({ ...current, query: d.value.toUpperCase() })}
                                    onBlur={handleLookup}
                                    onKeyDown={e => e.key === 'Enter' && handleLookup()}
                                    placeholder="Scan or Type..."
                                    contentAfter={lookupLoading ? <Spinner size="tiny" /> : <SearchRegular />}
                                    style={{ textTransform: 'uppercase', fontFamily: "monospace" }}
                                />
                                {fetchedItem && (
                                    <div className={styles.successText}>
                                        <CheckmarkCircleRegular />
                                        {fetchedItem.profile.type} {fetchedItem.profile.dimensions} ({fetchedItem.grade.name}) — {fetchedItem.length}mm
                                    </div>
                                )}
                                {lookupError && (
                                    <div className={styles.errorText}>
                                        <DismissCircleRegular /> {lookupError}
                                    </div>
                                )}
                            </div>

                            <Field label="Used (mm)" className={styles.field} style={{ maxWidth: '100px' }}>
                                <Input
                                    type="number"
                                    value={current.usedLength}
                                    onChange={(e, d) => setCurrent({ ...current, usedLength: d.value })}
                                    placeholder={fetchedItem ? `${fetchedItem.length}` : "0"}
                                />
                            </Field>

                            <Field label={`Remaining: ${remainingLength > 0 ? remainingLength + 'mm' : 'None'}`} className={styles.field} style={{ minWidth: '140px' }}>
                                <Dropdown
                                    value={offcutType === 'REMNANT' ? "Keep (Remnant)" : "Discard (Scrap)"}
                                    onOptionSelect={(e, d) => setOffcutType(d.optionValue as any)}
                                    disabled={remainingLength <= 0}
                                >
                                    <Option value="REMNANT">Keep (Remnant)</Option>
                                    <Option value="SCRAP">Discard (Scrap)</Option>
                                </Dropdown>
                            </Field>

                            <Field label="Row Project (Optional)" className={styles.field} style={{ minWidth: '150px' }}>
                                <Combobox
                                    value={projects.find(p => p.id === current.project)?.name || (current.project ? "Selected" : "Inherit Global")}
                                    onOptionSelect={(e, d) => setCurrent({ ...current, project: d.optionValue || '' })}
                                    placeholder="Inherit Global"
                                >
                                    <Option value="" text="Inherit Global">Inherit Global</Option>
                                    {projectOptions.map(p => <Option key={p.value} value={p.value} text={p.text}>{p.text}</Option>)}
                                </Combobox>
                            </Field>

                            <Button icon={<AddRegular />} disabled={!fetchedItem} onClick={handleAddLine} style={{ marginBottom: '2px' }}>Add</Button>
                        </div>
                    </div>

                    {/* Table */}
                    {lines.length > 0 && (
                        <div className={styles.section} style={{ flex: 1, overflow: 'hidden', padding: 0 }}>
                            <div style={{ padding: '12px 16px', fontWeight: 'bold' }}>Added Lines ({lines.length})</div>
                            <div style={{ overflowY: 'auto', flex: 1 }}>
                                <Table size="small">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHeaderCell>ID</TableHeaderCell>
                                            <TableHeaderCell>Desc</TableHeaderCell>
                                            <TableHeaderCell>Used</TableHeaderCell>
                                            <TableHeaderCell>Action</TableHeaderCell>
                                            <TableHeaderCell>Project</TableHeaderCell>
                                            <TableHeaderCell style={{ textAlign: 'right' }}>Cost</TableHeaderCell>
                                            <TableHeaderCell />
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {lines.map((line, i) => (
                                            <TableRow key={line._id}>
                                                <TableCell style={{ fontFamily: 'monospace' }}>{line.item.lotId}</TableCell>
                                                <TableCell>{line.item.profile.type} {line.item.profile.dimensions}</TableCell>
                                                <TableCell>{line.usedLength}mm</TableCell>
                                                <TableCell>
                                                    {line.item.length - line.usedLength > 0 ? (
                                                        <Badge appearance={line.createRemnant ? "filled" : "ghost"} color={line.createRemnant ? "success" : "danger"}>
                                                            {line.createRemnant ? "Remnant" : "Scrap"}
                                                        </Badge>
                                                    ) : "-"}
                                                </TableCell>
                                                <TableCell>{projects.find(p => p.id === line.project)?.name || "Global"}</TableCell>
                                                <TableCell style={{ textAlign: 'right' }}>€{line.cost.toFixed(2)}</TableCell>
                                                <TableCell>
                                                    <Button icon={<DeleteRegular />} appearance="subtle" onClick={() => handleRemoveLine(i)} />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        <TableRow style={{ fontWeight: 'bold', backgroundColor: tokens.colorNeutralBackground3 }}>
                                            <TableCell colSpan={5} style={{ textAlign: 'right' }}>Total Cost</TableCell>
                                            <TableCell style={{ textAlign: 'right' }}>€{totalCost.toFixed(2)}</TableCell>
                                            <TableCell />
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </DialogBody>
                <DialogActions>
                    <Button appearance="secondary" onClick={() => setOpen(false)}>Close</Button>
                    <Button
                        appearance="primary"
                        icon={<SaveRegular />}
                        disabled={lines.length === 0 || loading || (!globalProject && lines.some(l => !l.project))}
                        onClick={submitUsage}
                    >
                        {loading ? "Processing..." : `Register (${lines.length})`}
                    </Button>
                </DialogActions>
            </DialogSurface>
        </Dialog>
    )
}
