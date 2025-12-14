import { getInventory, getProfiles, deleteInventory } from "@/app/actions/inventory"
import { CreateInventoryDialog } from "@/components/create-inventory-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { revalidatePath } from "next/cache"

export const dynamic = 'force-dynamic'

export default async function InventoryPage() {
    // Try/catch for build safety
    let inventory: any[] = []
    let profiles: any[] = []
    try {
        inventory = await getInventory()
        profiles = await getProfiles()
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
                <CreateInventoryDialog profiles={profiles} />
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
                                <TableCell>{item.certificateFilename || '-'}</TableCell>
                                <TableCell>{item.status}</TableCell>
                                <TableCell className="text-sm text-gray-500">{item.createdBy || '-'}</TableCell>
                                <TableCell>
                                    <form action={deleteItem}>
                                        <input type="hidden" name="id" value={item.id} />
                                        <Button variant="destructive" size="sm" type="submit">Delete</Button>
                                    </form>
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
