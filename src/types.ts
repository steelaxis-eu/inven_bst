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

export interface Project {
    id: string
    projectNumber: string
    name: string
    status: 'ACTIVE' | 'ARCHIVED' | 'COMPLETED'
    createdAt: Date
    updatedAt: Date
    createdBy: string | null
    modifiedBy: string | null
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
