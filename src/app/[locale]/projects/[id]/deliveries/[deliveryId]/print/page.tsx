import { getDeliverySchedule } from "@/app/actions/deliveries"
import { notFound } from "next/navigation"
import { DeliveryPrintView } from "./delivery-print-view"

export default async function PackingListPage({ params }: { params: Promise<{ id: string, deliveryId: string }> }) {
    const { id, deliveryId } = await params
    const delivery = await getDeliverySchedule(deliveryId)

    if (!delivery) {
        notFound()
    }

    return <DeliveryPrintView delivery={delivery} projectId={id} />
}
