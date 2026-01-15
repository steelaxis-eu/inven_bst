'use client'

import { Button } from "@fluentui/react-components"
import { PrintRegular } from "@fluentui/react-icons"

export function PrintButton() {
    return (
        <Button onClick={() => window.print()} icon={<PrintRegular />}>
            Print Packing List
        </Button>
    )
}
