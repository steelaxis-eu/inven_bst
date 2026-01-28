"use client"

import {
    Title1,
    Title3,
    Text,
    Badge,
    Card,
    CardHeader,
    ProgressBar,
    tokens
} from "@fluentui/react-components"
import { WarningRegular } from "@fluentui/react-icons"
import { ImportDrawingsDialog } from "@/components/project/import-drawings-dialog"
import { SmartImportDialog } from "@/components/project/smart-import-dialog"
import { DownloadCertificatesButton } from "@/components/download-certificates-button"
import { EditProjectDialog } from "@/components/project/edit-project-dialog"
import { BackgroundTasksIndicator } from "@/components/project/background-tasks-indicator"
import { ProjectTabs } from "@/components/project/project-tabs"
import { UnifiedPartItem } from "@/components/project/unified-parts-table"

interface ProjectDetailsViewProps {
    project: any
    cleanId: string
    overallProgress: number
    readyPieces: number
    totalPieces: number
    missingCertCount: number
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

export function ProjectDetailsView({
    project,
    cleanId,
    overallProgress,
    readyPieces,
    totalPieces,
    missingCertCount,
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
}: ProjectDetailsViewProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <Title1>{project.projectNumber}</Title1>
                        <Badge appearance="tint" shape="rounded" color="brand">
                            {project.status}
                        </Badge>
                    </div>
                    <Title3 style={{ color: tokens.colorNeutralForeground3, marginTop: 0 }}>{project.name}</Title3>
                    {project.client && (
                        <Text block style={{ color: tokens.colorNeutralForeground3 }}>Client: {project.client}</Text>
                    )}
                    {project.coatingType && (
                        <Text block style={{ color: tokens.colorNeutralForeground3 }}>
                            Coating: <strong>{project.coatingType}</strong>
                            {project.coatingSpec && ` - ${project.coatingSpec}`}
                        </Text>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <BackgroundTasksIndicator projectId={project.id} />
                    {missingCertCount > 0 ? (
                        <Badge appearance="filled" color="danger" icon={<WarningRegular />}>
                            {missingCertCount} missing certs
                        </Badge>
                    ) : (
                        <DownloadCertificatesButton projectId={project.id} projectNumber={project.projectNumber} />
                    )}
                    <EditProjectDialog project={{
                        id: project.id,
                        name: project.name,
                        client: project.client,
                        description: project.description,
                        priority: project.priority,
                        coatingType: project.coatingType,
                        coatingSpec: project.coatingSpec
                    }} />
                    <ImportDrawingsDialog
                        projectId={cleanId}
                        projectName={project.name}
                        profiles={profiles}
                        standardProfiles={standardProfiles}
                        grades={grades}
                        shapes={shapes}
                    />
                    <SmartImportDialog
                        projectId={cleanId}
                        projectName={project.name}
                        profiles={profiles}
                        standardProfiles={standardProfiles}
                        grades={grades}
                        shapes={shapes}
                    />
                </div>
            </div>

            {/* Overview Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <Card>
                    <CardHeader header={<Text weight="medium" style={{ color: tokens.colorNeutralForeground3 }}>Progress</Text>} />
                    <div style={{ padding: '0 12px 12px 12px' }}>
                        <Text size={600} weight="bold" block>{overallProgress}%</Text>
                        <ProgressBar value={overallProgress / 100} thickness="large" shape="rounded" style={{ marginTop: '8px', height: '8px' }} />
                        <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: '4px' }}>{readyPieces}/{totalPieces} pieces</Text>
                    </div>
                </Card>
                {/* Other summary cards could go here */}
            </div>

            {/* Main Content Tabs */}
            <ProjectTabs
                projectId={cleanId}
                project={project}
                inHouseItems={inHouseItems}
                outsourcedItems={outsourcedItems}
                assemblies={assemblies}
                workOrders={workOrders}
                qualityChecks={qualityChecks}
                deliveries={deliveries}
                profiles={profiles}
                standardProfiles={standardProfiles}
                grades={grades}
                shapes={shapes}
                inventoryMap={inventoryMap}
                parts={parts}
            />
        </div>
    )
}
