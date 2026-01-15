import { searchStock } from "@/app/actions/stock"
import { StockView } from "./stock-view"

export default async function StockPage({ searchParams }: { searchParams: Promise<{ q?: string, type?: string, dim?: string }> }) {
    const { q, type, dim } = await searchParams
    let stock: any[] = []
    try {
        stock = await searchStock(q, type, dim)
    } catch (e) { }

    return <StockView stock={stock} />
}
