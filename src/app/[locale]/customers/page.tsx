import { getCustomers } from "@/app/actions/customers"
import { CustomersView } from "./customers-view"

export const dynamic = 'force-dynamic'

export default async function CustomersPage() {
    let customers: any[] = []
    try {
        customers = await getCustomers()
    } catch (e) {
        console.error("Failed to load customers", e)
    }

    return <CustomersView customers={customers} />
}
