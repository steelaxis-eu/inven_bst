import { getInventory, getProfiles, getStandardProfiles, getGrades, deleteInventory } from "@/app/actions/inventory"
import { CreateInventoryDialog } from "@/components/create-inventory-dialog"
import { EditInventoryDialog } from "@/components/edit-inventory-dialog"
import { InventoryCertActions } from "@/components/inventory-cert-actions"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { revalidatePath } from "next/cache"

export const dynamic = 'force-dynamic'

export default async function InventoryPage() {
    // Try/catch for build safety
    let inventory: any[] = []
    let profiles: any[] = []
    let standardProfiles: any[] = []
    let grades: any[] = []
    try {
        inventory = await getInventory()
        profiles = await getProfiles()
        standardProfiles = await getStandardProfiles()
        grades = await getGrades()
    } catch (e) { }

    async function deleteItem(formData: FormData) {
        'use server'
        const id = formData.get('id') as string
        if (id) await deleteInventory(id)
    }

    return (
        <div className="container mx-auto py-8">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">Inventory Management</h1>
                <CreateInventoryDialog
                    profiles={profiles}
                    standardProfiles={standardProfiles}
                    grades={grades}
                />
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Lot ID</TableHead>
                            <TableHead>Profile</TableHead>
                            <TableHead>Dims</TableHead>
                            <TableHead>Length</TableHead>
                            <TableHead>Qty Hand / Rcv</TableHead>
                            <TableHead>Certificate</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created By</TableHead>
                            <TableHead>Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {inventory.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell className="font-mono font-medium">{item.lotId}</TableCell>
                                <TableCell>{item.profile.type}</TableCell>
                                <TableCell>{item.profile.dimensions}</TableCell>
                                <TableCell>{item.length} mm</TableCell>
                                <TableCell>{item.quantityAtHand} / {item.quantityReceived}</TableCell>
                                <TableCell>
                                    <InventoryCertActions id={item.id} certificate={item.certificateFilename} />
                                </TableCell>
                                <TableCell>{item.status}</TableCell>
                                <TableCell className="text-sm text-gray-500">{item.createdBy || '-'}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <EditInventoryDialog item={item} />
                                        <form action={deleteItem}>
                                            <input type="hidden" name="id" value={item.id} />
                                            <Button variant="destructive" size="icon" className="h-6 w-6" type="submit" title="Delete">
                                                <span className="sr-only">Delete</span>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                            </Button>
                                        </form>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {inventory.length === 0 && (
                            <TableRow><TableCell colSpan={8} className="text-center py-8">No inventory items.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
