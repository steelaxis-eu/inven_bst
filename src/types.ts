/**
 * SteelSys Domain Types
 * Shared TypeScript interfaces for domain entities
 */

// ============================================================================
// Base Types
// ============================================================================

export interface SteelProfile {
    id: string
    type: string
    dimensions: string
    weightPerMeter: number
}

export interface StandardProfile {
    id: string
    type: string
    dimensions: string
    weightPerMeter: number
    crossSectionArea: number | null
}

export interface ProfileShape {
    id: string
    name: string
    params: string[]
    formula: string | null
}

export interface MaterialGrade {
    id: string
    name: string
    density: number
    scrapPrice: number
}

// ============================================================================
// Inventory Types
// ============================================================================

export interface Inventory {
    id: string
    lotId: string
    profileId: string
    gradeId: string
    length: number
    quantityReceived: number
    quantityAtHand: number
    costPerMeter: number
    certificateFilename: string | null
    status: 'ACTIVE' | 'EXHAUSTED'
    createdAt: Date
    updatedAt: Date
    createdBy: string | null
    modifiedBy: string | null
}

export interface InventoryWithRelations extends Inventory {
    profile: SteelProfile
    grade: MaterialGrade
}

export interface Remnant {
    id: string
    rootLotId: string
    profileId: string
    gradeId: string
    length: number
    quantity: number
    costPerMeter: number
    status: 'AVAILABLE' | 'USED' | 'SCRAP'
    createdAt: Date
    updatedAt: Date
    createdBy: string | null
    modifiedBy: string | null
    projectId: string | null
}

export interface RemnantWithRelations extends Remnant {
    profile: SteelProfile
    grade: MaterialGrade
}

// ============================================================================
// Project Types
// ============================================================================

export type ProjectStatus = 'ACTIVE' | 'COMPLETED' | 'ON_HOLD' | 'ARCHIVED'
export type ProjectPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface Project {
    id: string
    projectNumber: string
    name: string
    client: string | null
    description: string | null
    priority: ProjectPriority
    scheduledStart: Date | null
    scheduledEnd: Date | null
    status: ProjectStatus
    createdAt: Date
    updatedAt: Date
    createdBy: string | null
    modifiedBy: string | null
}

// ============================================================================
// Part & Piece Types (BOM)
// ============================================================================

export type PartPieceStatus = 'PENDING' | 'CUT' | 'FABRICATED' | 'WELDED' | 'PAINTED' | 'READY'

export interface Part {
    id: string
    projectId: string
    partNumber: string
    description: string | null
    profileId: string | null
    gradeId: string | null
    length: number | null
    quantity: number
    unitWeight: number
    requiresWelding: boolean
    drawingRef: string | null
    notes: string | null
    createdAt: Date
    updatedAt: Date
}

export interface PartWithRelations extends Part {
    profile: SteelProfile | null
    grade: MaterialGrade | null
    pieces: PartPiece[]
}

export interface PartPiece {
    id: string
    partId: string
    pieceNumber: number
    status: PartPieceStatus
    inventoryId: string | null
    remnantId: string | null
    cutAt: Date | null
    fabricatedAt: Date | null
    weldedAt: Date | null
    paintedAt: Date | null
    completedAt: Date | null
    completedBy: string | null
    notes: string | null
}

// ============================================================================
// Assembly Types
// ============================================================================

export type AssemblyStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'ASSEMBLED' | 'QC_PASSED' | 'SHIPPED'

export interface Assembly {
    id: string
    projectId: string
    parentId: string | null
    assemblyNumber: string
    name: string
    description: string | null
    sequence: number
    status: AssemblyStatus
    scheduledDate: Date | null
    shippedAt: Date | null
    notes: string | null
    createdAt: Date
    updatedAt: Date
}

export interface AssemblyWithRelations extends Assembly {
    parent: Assembly | null
    children: Assembly[]
    assemblyParts: AssemblyPartWithRelations[]
}

export interface AssemblyPart {
    id: string
    assemblyId: string
    partId: string
    quantityInAssembly: number
    notes: string | null
}

export interface AssemblyPartWithRelations extends AssemblyPart {
    part: PartWithRelations
}

// ============================================================================
// Delivery Schedule Types
// ============================================================================

export type DeliveryStatus = 'PENDING' | 'SHIPPED' | 'DELIVERED'

export interface DeliverySchedule {
    id: string
    projectId: string
    name: string
    scheduledDate: Date
    notes: string | null
    status: DeliveryStatus
    shippedAt: Date | null
    deliveredAt: Date | null
    createdAt: Date
    updatedAt: Date
}

export interface DeliveryItem {
    id: string
    deliveryScheduleId: string
    assemblyId: string
}

export interface DeliveryScheduleWithRelations extends DeliverySchedule {
    items: (DeliveryItem & { assembly: Assembly })[]
}

// ============================================================================
// Quality Check Types
// ============================================================================

export type QualityCheckStatus = 'PENDING' | 'PASSED' | 'FAILED' | 'WAIVED'
export type ProcessStage = 'FABRICATION' | 'WELDING' | 'PAINTING' | 'FINAL'
export type QualityCheckType = 'VISUAL' | 'DIMENSIONAL' | 'NDT' | 'COATING'

export interface QualityCheck {
    id: string
    projectId: string
    assemblyId: string | null
    processStage: ProcessStage
    type: QualityCheckType
    status: QualityCheckStatus
    inspectedBy: string | null
    inspectedAt: Date | null
    dueDate: Date | null
    findings: string | null
    ncr: string | null
    createdAt: Date
    updatedAt: Date
}

// ============================================================================
// Work Order Types
// ============================================================================

export type WorkOrderType = 'CUTTING' | 'FABRICATION' | 'WELDING' | 'PAINTING' | 'ASSEMBLY'
export type WorkOrderStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type WorkOrderPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export interface WorkOrder {
    id: string
    projectId: string
    workOrderNumber: string
    title: string
    description: string | null
    type: WorkOrderType
    priority: WorkOrderPriority
    status: WorkOrderStatus
    assignedTo: string | null
    scheduledDate: Date | null
    startedAt: Date | null
    completedAt: Date | null
    notes: string | null
    createdAt: Date
    updatedAt: Date
}

export interface WorkOrderItem {
    id: string
    workOrderId: string
    pieceId: string | null
    assemblyId: string | null
    platePartId: string | null
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
    completedAt: Date | null
    notes: string | null
}

// ============================================================================
// Document Types
// ============================================================================

export type DocumentType = 'DRAWING' | 'PHOTO' | 'CERTIFICATE' | 'SPEC' | 'NCR' | 'OTHER'

export interface ProjectDocument {
    id: string
    projectId: string
    assemblyId: string | null
    pieceId: string | null
    platePartId: string | null
    qualityCheckId: string | null
    type: DocumentType
    filename: string
    storagePath: string
    mimeType: string | null
    fileSize: number | null
    description: string | null
    uploadedBy: string | null
    uploadedAt: Date
}

// ============================================================================
// Plate Part Types (Outsourced Laser/Plasma)
// ============================================================================

export type PlatePartStatus = 'PENDING' | 'ORDERED' | 'IN_PRODUCTION' | 'RECEIVED' | 'QC_PASSED'

export interface PlatePart {
    id: string
    projectId: string
    partNumber: string
    description: string | null
    material: string | null
    gradeId: string | null
    thickness: number | null
    quantity: number
    unitWeight: number
    dxfFilename: string | null
    dxfStoragePath: string | null  // projects/{projectId}/Plates/{filename}
    nestingSheet: string | null
    supplier: string | null
    poNumber: string | null
    status: PlatePartStatus
    orderedAt: Date | null
    expectedDate: Date | null
    receivedAt: Date | null
    receivedQty: number
    notes: string | null
    createdAt: Date
    updatedAt: Date
}

export interface PlateAssemblyPart {
    id: string
    assemblyId: string
    platePartId: string
    quantityInAssembly: number
    notes: string | null
}


// ============================================================================
// Usage Types
// ============================================================================

export interface Usage {
    id: string
    projectId: string
    date: Date
    userId: string
    createdBy: string | null
    modifiedBy: string | null
}

export interface UsageLine {
    id: string
    usageId: string
    inventoryId: string | null
    remnantId: string | null
    quantityUsed: number
    cost: number
    projectId: string | null
}

export interface UsageLineWithRelations extends UsageLine {
    inventory: InventoryWithRelations | null
    remnant: RemnantWithRelations | null
}

export interface UsageWithRelations extends Usage {
    project: Project
    lines: UsageLineWithRelations[]
}

// ============================================================================
// Stock Search Types
// ============================================================================

export interface StockItem {
    id: string
    originalId: string
    type: 'INVENTORY' | 'REMNANT'
    profileType: string
    dimensions: string
    grade: string
    length: number
    quantity: number
    costPerMeter: number
    location: string
    status: string
}

// ============================================================================
// Form/Input Types
// ============================================================================

export interface CreateInventoryInput {
    lotId: string
    profileId: string
    gradeId: string
    length: number
    quantity: number
    certificate: string
    totalCost: number
}

export interface CreateProjectInput {
    number: string
    name: string
}

export interface CreateUsageLineInput {
    type: 'INVENTORY' | 'REMNANT'
    id: string
    lengthUsed: number
    createRemnant: boolean
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ActionResult<T = void> {
    success: boolean
    error?: string
    data?: T
}

export interface ProjectStats {
    missingCertCount: number
    totalProjectCost: number
    totalScrapValue: number
    totalScrapWeight: number
    netCost: number
    materialSummary: MaterialSummaryItem[]
    scrapPrice: number
}

export interface MaterialSummaryItem {
    profile: string
    totalLength: number
    totalCost: number
    count: number
}
