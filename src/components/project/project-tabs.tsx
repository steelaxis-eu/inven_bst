'use client'

import {
    Tab,
    TabList,
    makeStyles,
    tokens,
    Card,
    CardHeader,
    CardPreview,
    Text,
    Title3,
    Button,
    shorthands
} from "@fluentui/react-components"
import {
    BuildingFactoryRegular,
    CartRegular,
    LayerRegular,
    ClipboardTaskRegular,
    ShieldRegular,
    VehicleTruckProfileRegular,
    DataUsageRegular
} from "@fluentui/react-icons"
import { useState } from "react"

import { UnifiedPartsTable, UnifiedPartItem } from "@/components/project/unified-parts-table"
import { ImportDrawingsDialog } from '@/components/project/import-drawings-dialog'
import { CreatePartDialog } from "@/components/project/create-part-dialog"
import { CreateAssemblyDialog } from "@/components/project/create-assembly-dialog"
import { AssembliesTree, AssemblySummary } from "@/components/project/assemblies-tree"
import { RecalculateWeightsButton } from "@/components/project/recalculate-weights-button"
import { WorkOrdersList, WorkOrderSummary } from "@/components/project/workorders-list"
import { ProjectQualityTab } from "@/components/project/project-quality-tab"
import { DeliveriesList, DeliveriesSummary } from "@/components/project/deliveries-list"

const useStyles = makeStyles({
    root: {
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
    },
    tabList: {
        backgroundColor: tokens.colorNeutralBackground1,
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        padding: '4px',
        border: `1px solid ${tokens.colorNeutralStroke2}`
    },
    tabContent: {
        animationName: {
            from: { opacity: 0, transform: 'translateY(4px)' },
            to: { opacity: 1, transform: 'translateY(0)' }
        },
        animationDuration: '0.2s',
        animationFillMode: 'forwards'
    },
    headerRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '16px'
    },
    usageGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px'
    },
    usageStat: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
    }
})

interface ProjectTabsProps {
    projectId: string
    project: any
    inHouseItems: UnifiedPartItem[]
    outsourcedItems: UnifiedPartItem[]
    assemblies: any[]
    workOrders: any[]
    qualityChecks: any[]
    deliveries: any[]
    profiles: any[]
    standardProfiles: any[]
    grades: any[]
    shapes: any[]
    inventoryMap: any[]
    parts: any[]
}

export function ProjectTabs({
    projectId,
    project,
    inHouseItems,
    outsourcedItems,
    assemblies,
    workOrders,
    qualityChecks,
    deliveries,
    profiles,
    standardProfiles,
    grades,
    shapes,
    inventoryMap,
    parts
}: ProjectTabsProps) {
    const styles = useStyles()
    const [selectedTab, setSelectedTab] = useState<string>("inhouse")

    return (
        <div className={styles.root}>
            <TabList
                selectedValue={selectedTab}
                onTabSelect={(_, data) => setSelectedTab(data.value as string)}
                className={styles.tabList}
            >
                <Tab value="inhouse" icon={<BuildingFactoryRegular />}>In-House</Tab>
                <Tab value="outsourced" icon={<CartRegular />}>Outsourced</Tab>
                <Tab value="assemblies" icon={<LayerRegular />}>Assemblies</Tab>
                <Tab value="workorders" icon={<ClipboardTaskRegular />}>Work Orders</Tab>
                <Tab value="quality" icon={<ShieldRegular />}>Quality</Tab>
                <Tab value="deliveries" icon={<VehicleTruckProfileRegular />}>Deliveries</Tab>
                <Tab value="usage" icon={<DataUsageRegular />}>Usage & Costs</Tab>
            </TabList>

            <div className={styles.tabContent}>
                {selectedTab === "inhouse" && (
                    <>
                        <div className={styles.headerRow}>
                            <div>
                                <Title3>In-House Production</Title3>
                                <Text block style={{ color: tokens.colorNeutralForeground3 }}>Items fabricated internally (Profiles & Plates)</Text>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <RecalculateWeightsButton projectId={projectId} />
                                <ImportDrawingsDialog
                                    projectId={projectId}
                                    profiles={profiles.map((p: any) => ({ id: p.id, type: p.type, dimensions: p.dimensions, weightPerMeter: p.weightPerMeter }))}
                                    standardProfiles={standardProfiles.map((p: any) => ({ type: p.type, dimensions: p.dimensions, weightPerMeter: p.weightPerMeter }))}
                                    grades={grades.map((g: any) => ({ id: g.id, name: g.name }))}
                                    shapes={shapes.map((s: any) => ({ id: s.id, params: (s.params as string[]) || [] }))}
                                />
                                <CreatePartDialog
                                    projectId={projectId}
                                    profiles={profiles.map((p: any) => ({ id: p.id, type: p.type, dimensions: p.dimensions, weightPerMeter: p.weightPerMeter }))}
                                    standardProfiles={standardProfiles.map((p: any) => ({ type: p.type, dimensions: p.dimensions, weightPerMeter: p.weightPerMeter }))}
                                    grades={grades.map((g: any) => ({ id: g.id, name: g.name }))}
                                    shapes={shapes.map((s: any) => ({ id: s.id, params: (s.params as string[]) || [], formula: s.formula }))}
                                    inventory={inventoryMap}
                                />
                            </div>
                        </div>
                        <UnifiedPartsTable items={inHouseItems} projectId={projectId} />
                    </>
                )}

                {selectedTab === "outsourced" && (
                    <>
                        <div className={styles.headerRow}>
                            <div>
                                <Title3>Outsourced Items</Title3>
                                <Text block style={{ color: tokens.colorNeutralForeground3 }}>Items to be purchased or sub-contracted</Text>
                            </div>
                        </div>
                        <UnifiedPartsTable items={outsourcedItems} projectId={projectId} />
                    </>
                )}

                {selectedTab === "assemblies" && (
                    <>
                        <div className={styles.headerRow}>
                            <Title3>Assemblies</Title3>
                            <CreateAssemblyDialog
                                projectId={projectId}
                                existingParts={(parts as any)}
                                existingAssemblies={(assemblies as any)}
                                profiles={profiles.map((p: any) => ({ id: p.id, type: p.type, dimensions: p.dimensions, weightPerMeter: p.weightPerMeter }))}
                                standardProfiles={standardProfiles.map((p: any) => ({ type: p.type, dimensions: p.dimensions, weightPerMeter: p.weightPerMeter }))}
                                grades={grades.map((g: any) => ({ id: g.id, name: g.name }))}
                                shapes={shapes.map((s: any) => ({ id: s.id, params: (s.params as string[]) || [], formula: s.formula }))}
                            />
                        </div>
                        <AssemblySummary assemblies={assemblies} />
                        <AssembliesTree assemblies={assemblies} projectId={projectId} />
                    </>
                )}

                {selectedTab === "workorders" && (
                    <>
                        <div className={styles.headerRow}>
                            <Title3>Work Orders</Title3>
                        </div>
                        <WorkOrderSummary workOrders={workOrders} />
                        <WorkOrdersList workOrders={workOrders} />
                    </>
                )}

                {selectedTab === "quality" && (
                    <ProjectQualityTab
                        projectId={projectId}
                        checks={qualityChecks}
                        assemblies={assemblies}
                    />
                )}

                {selectedTab === "deliveries" && (
                    <>
                        <div className={styles.headerRow}>
                            <Title3>Delivery Schedule</Title3>
                        </div>
                        <DeliveriesSummary deliveries={deliveries} />
                        <DeliveriesList deliveries={deliveries} />
                    </>
                )}

                {selectedTab === "usage" && (
                    <UsageTabContent project={project} styles={styles} />
                )}
            </div>
        </div>
    )
}

function UsageTabContent({ project, styles }: { project: any, styles: ReturnType<typeof useStyles> }) {
    const {
        totalProjectCost = 0,
        totalScrapValue = 0,
        totalScrapWeight = 0,
        netCost = 0,
        materialSummary = [],
        scrapPrice = 0
    } = project.stats || {}

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <Card>
                <CardHeader header={<Text weight="semibold">Cost Summary</Text>} />
                <div className={styles.usageGrid} style={{ padding: '0 12px 12px 12px' }}>
                    <div className={styles.usageStat}>
                        <Text style={{ color: tokens.colorNeutralForeground3 }}>Total Material</Text>
                        <Text size={500} weight="bold">€{totalProjectCost.toFixed(2)}</Text>
                    </div>
                    <div className={styles.usageStat}>
                        <Text style={{ color: tokens.colorNeutralForeground3 }}>Scrap Value</Text>
                        <Text size={500} weight="bold" style={{ color: tokens.colorPaletteGreenForeground1 }}>-€{totalScrapValue.toFixed(2)}</Text>
                        <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>{totalScrapWeight.toFixed(1)}kg</Text>
                    </div>
                    <div className={styles.usageStat}>
                        <Text style={{ color: tokens.colorNeutralForeground3 }}>Net Cost</Text>
                        <Text size={500} weight="bold" style={{ color: tokens.colorBrandForeground1 }}>€{netCost.toFixed(2)}</Text>
                    </div>
                    <div className={styles.usageStat}>
                        <Text style={{ color: tokens.colorNeutralForeground3 }}>Avg Scrap Price</Text>
                        <Text size={500} weight="bold">€{scrapPrice.toFixed(2)}/kg</Text>
                    </div>
                </div>
            </Card>

            <Card>
                <CardHeader header={<Text weight="semibold">Material Summary</Text>} />
                <div style={{ padding: '0 12px 12px 12px' }}>
                    {materialSummary.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '32px', color: tokens.colorNeutralForeground3 }}>
                            No materials used yet.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {materialSummary.map((stat: any) => (
                                <div
                                    key={stat.profile}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        padding: '12px',
                                        backgroundColor: tokens.colorNeutralBackground2,
                                        borderRadius: tokens.borderRadiusMedium
                                    }}
                                >
                                    <Text weight="medium">{stat.profile}</Text>
                                    <div style={{ display: 'flex', gap: '32px' }}>
                                        <Text>{stat.count} items</Text>
                                        <Text>{stat.totalLength.toFixed(0)} mm</Text>
                                        <Text weight="semibold">€{stat.totalCost.toFixed(2)}</Text>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Card>
        </div>
    )
}
