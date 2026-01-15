import { getGlobalUsageHistory } from "@/app/actions/history"
import { HistoryView } from "./history-view"

export const dynamic = 'force-dynamic'

export default async function HistoryPage() {
    let history: any[] = []
    try {
        history = await getGlobalUsageHistory()
    } catch (e) { }

    return <HistoryView history={history} />
}
