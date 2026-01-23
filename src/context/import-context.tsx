'use client'

import { createContext, useContext, ReactNode } from 'react'
import { ParsedPart, ParsedAssembly } from '@/app/actions/drawings'

// DEPRECATED: This context is no longer used. 
// The new ImportDrawingsDialog handles everything with local state + queue.
// Kept as stub for backward compatibility with import-status.tsx

interface ImportState {
    isProcessing: boolean
    progress: number
    status: 'idle' | 'uploading' | 'processing' | 'reviewing' | 'complete' | 'error'
    mode: 'parts' | 'assemblies'
    fileName: string | null
    projectName: string | null
    resultParts: any[]
    resultAssemblies: any[]
    isDialogOpen: boolean
}

interface ImportContextType extends ImportState {
    startImport: (file: File, mode: 'parts' | 'assemblies', projectId: string, projectName: string) => Promise<void>
    reset: () => void
    setReviewing: () => void
    dismiss: () => void
    openDialog: () => void
    closeDialog: () => void
}

const defaultState: ImportState = {
    isProcessing: false,
    progress: 0,
    status: 'idle',
    mode: 'parts',
    fileName: null,
    projectName: null,
    resultParts: [],
    resultAssemblies: [],
    isDialogOpen: false
}

const ImportContext = createContext<ImportContextType | undefined>(undefined)

export function ImportProvider({ children }: { children: ReactNode }) {
    // Stub implementation - all functions are no-ops
    const value: ImportContextType = {
        ...defaultState,
        startImport: async () => { },
        reset: () => { },
        setReviewing: () => { },
        dismiss: () => { },
        openDialog: () => { },
        closeDialog: () => { }
    }

    return (
        <ImportContext.Provider value={value}>
            {children}
        </ImportContext.Provider>
    )
}

export function useImport() {
    const context = useContext(ImportContext)
    if (context === undefined) {
        throw new Error('useImport must be used within an ImportProvider')
    }
    return context
}
