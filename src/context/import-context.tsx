'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { ParsedPart, ParsedAssembly } from '@/app/actions/drawings'
import { toast } from 'sonner'
import { parseDrawingsZip, parseAssemblyZip, processSingleDrawing } from '@/app/actions/drawings'

interface ImportState {
    isProcessing: boolean
    progress: number // 0-100 (simulated/estimated)
    status: 'idle' | 'uploading' | 'processing' | 'reviewing' | 'complete' | 'error'
    mode: 'parts' | 'assemblies'
    fileName: string | null
    projectName: string | null
    resultParts: any[] // Using any to avoid strict type duplication for now, or import ReviewPart if possible
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

const ImportContext = createContext<ImportContextType | undefined>(undefined)

export function ImportProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<ImportState>({
        isProcessing: false,
        progress: 0,
        status: 'idle',
        mode: 'parts',
        fileName: null,
        projectName: null,
        resultParts: [],
        resultAssemblies: [],
        isDialogOpen: false
    })

    // Load from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('import_context_state')
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                setState(prev => ({ ...prev, ...parsed }))
            } catch (e) {
                console.error("Failed to load import state", e)
            }
        }
    }, [])

    // Save to localStorage on change
    useEffect(() => {
        if (state.status !== 'idle') {
            localStorage.setItem('import_context_state', JSON.stringify(state))
        } else {
            // If idle, maybe clear it? Or keep it? kept for now, but usually clear on full reset
        }
    }, [state])

    const startImport = async (file: File, mode: 'parts' | 'assemblies', projectId: string, projectName: string) => {
        setState(prev => ({
            ...prev,
            isProcessing: true,
            status: 'uploading',
            progress: 0,
            mode,
            fileName: file.name,
            projectName,
            resultParts: [],
            resultAssemblies: [],
            isDialogOpen: true // Keep open explicitly
        }))

        try {
            if (mode === 'parts') {
                const JSZip = (await import('jszip')).default
                const zip = new JSZip()
                const zipContent = await zip.loadAsync(file)

                const pdfFiles = Object.values(zipContent.files).filter(file =>
                    file.name.toLowerCase().endsWith('.pdf') &&
                    !file.name.startsWith('__MACOSX') &&
                    !file.name.split('/').pop()?.startsWith('._') &&
                    !file.dir
                )

                if (pdfFiles.length === 0) {
                    throw new Error("No PDF files found in ZIP")
                }

                const totalFiles = pdfFiles.length
                let processedCount = 0
                const allParts: any[] = []
                const CONCURRENCY = 3

                setState(prev => ({ ...prev, status: 'processing', progress: 0 }))

                // Helper to process a single file from the zip
                const processFile = async (zipEntry: any) => {
                    const blob = await zipEntry.async('blob')
                    // Create a proper File object to preserve filename
                    const singleFile = new File([blob], zipEntry.name.split('/').pop() || zipEntry.name, { type: 'application/pdf' })

                    const formData = new FormData()
                    formData.append('file', singleFile)

                    const res = await processSingleDrawing(formData, projectId)

                    processedCount++
                    const percentage = Math.round((processedCount / totalFiles) * 100)

                    setState(prev => ({
                        ...prev,
                        progress: percentage
                    }))

                    if (res.success && res.parts) {
                        return res.parts
                    }
                    return []
                }

                // Batch processing with concurrency limit
                for (let i = 0; i < pdfFiles.length; i += CONCURRENCY) {
                    const chunk = pdfFiles.slice(i, i + CONCURRENCY)
                    const results = await Promise.all(chunk.map(entry => processFile(entry)))

                    for (const batch of results) {
                        allParts.push(...batch)
                    }
                }

                setState(prev => ({
                    ...prev,
                    isProcessing: false,
                    status: 'reviewing',
                    progress: 100,
                    resultParts: allParts.map(p => ({ ...p, include: true, status: 'PENDING' })) || [],
                    isDialogOpen: true // Ensure open for review
                }))

                toast.success(`Processed ${allParts.length} parts from ${totalFiles} drawings`)

            } else {
                // Keep server-side for assemblies for now or refactor later if needed
                // Simulate some progress
                const progressInterval = setInterval(() => {
                    setState(prev => {
                        if (prev.status === 'processing' && prev.progress < 90) {
                            return { ...prev, progress: prev.progress + (Math.random() * 5) }
                        }
                        return prev
                    })
                }, 2000)

                const formData = new FormData()
                formData.append('file', file)

                const res = await parseAssemblyZip(formData, projectId)
                clearInterval(progressInterval)

                if (res.success && res.assemblies) {
                    setState(prev => ({
                        ...prev,
                        isProcessing: false,
                        status: 'reviewing',
                        progress: 100,
                        resultAssemblies: res.assemblies?.map(a => ({ ...a, include: true, status: 'PENDING' })) || [],
                        isDialogOpen: true
                    }))
                    toast.success("Assemblies processed!")
                } else {
                    throw new Error(res.error)
                }
            }
        } catch (error: any) {
            console.error("Import Error:", error)
            setState(prev => ({
                ...prev,
                isProcessing: false,
                status: 'error',
                progress: 0
            }))
            toast.error(error.message || "Import failed")
        }
    }

    const reset = () => {
        localStorage.removeItem('import_context_state')
        setState({
            isProcessing: false,
            progress: 0,
            status: 'idle',
            mode: 'parts',
            fileName: null,
            projectName: null,
            resultParts: [],
            resultAssemblies: [],
            isDialogOpen: false
        })
    }

    const setReviewing = () => {
        setState(prev => ({ ...prev, status: 'reviewing', isDialogOpen: true }))
    }

    const openDialog = () => setState(prev => ({ ...prev, isDialogOpen: true }))
    const closeDialog = () => setState(prev => ({ ...prev, isDialogOpen: false }))

    const dismiss = () => {
        setState(prev => ({ ...prev, status: 'idle' })) // Hides the progress bar
    }

    return (
        <ImportContext.Provider value={{ ...state, startImport, reset, setReviewing, dismiss, openDialog, closeDialog }}>
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
