'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { ParsedPart, ParsedAssembly } from '@/app/actions/drawings'
import { toast } from 'sonner'
import { parseDrawingsZip, parseAssemblyZip } from '@/app/actions/drawings'

interface ImportState {
    isProcessing: boolean
    progress: number // 0-100 (simulated/estimated)
    status: 'idle' | 'uploading' | 'processing' | 'reviewing' | 'complete' | 'error'
    mode: 'parts' | 'assemblies'
    fileName: string | null
    resultParts: any[] // Using any to avoid strict type duplication for now, or import ReviewPart if possible
    resultAssemblies: any[]
}

interface ImportContextType extends ImportState {
    startImport: (file: File, mode: 'parts' | 'assemblies') => Promise<void>
    reset: () => void
    setReviewing: () => void
    dismiss: () => void
}

const ImportContext = createContext<ImportContextType | undefined>(undefined)

export function ImportProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<ImportState>({
        isProcessing: false,
        progress: 0,
        status: 'idle',
        mode: 'parts',
        fileName: null,
        resultParts: [],
        resultAssemblies: []
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

    const startImport = async (file: File, mode: 'parts' | 'assemblies') => {
        setState(prev => ({
            ...prev,
            isProcessing: true,
            status: 'uploading',
            progress: 10,
            mode,
            fileName: file.name,
            resultParts: [],
            resultAssemblies: []
        }))

        // Simulate upload progress
        setTimeout(() => setState(prev => ({ ...prev, status: 'processing', progress: 30 })), 1000)

        // Start polling simulation for progress (since we don't have real streaming yet)
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

        try {
            if (mode === 'parts') {
                const res = await parseDrawingsZip(formData)
                clearInterval(progressInterval)
                if (res.success && res.parts) {
                    setState(prev => ({
                        ...prev,
                        isProcessing: false,
                        status: 'reviewing',
                        progress: 100,
                        resultParts: res.parts?.map(p => ({ ...p, include: true, status: 'PENDING' })) || []
                    }))
                    toast.success("Drawings processed!", {
                        action: {
                            label: "Review",
                            onClick: () => { /* Logic is handled by components listening to status */ }
                        }
                    })
                } else {
                    throw new Error(res.error)
                }
            } else {
                const res = await parseAssemblyZip(formData)
                clearInterval(progressInterval)
                if (res.success && res.assemblies) {
                    setState(prev => ({
                        ...prev,
                        isProcessing: false,
                        status: 'reviewing',
                        progress: 100,
                        resultAssemblies: res.assemblies?.map(a => ({ ...a, include: true, status: 'PENDING' })) || []
                    }))
                    toast.success("Assemblies processed!", {
                        action: {
                            label: "Review",
                            onClick: () => { }
                        }
                    })
                } else {
                    throw new Error(res.error)
                }
            }
        } catch (error: any) {
            clearInterval(progressInterval)
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
            resultParts: [],
            resultAssemblies: []
        })
    }

    const setReviewing = () => {
        setState(prev => ({ ...prev, status: 'reviewing' }))
    }

    const dismiss = () => {
        setState(prev => ({ ...prev, status: 'idle' })) // Hides the progress bar
    }

    return (
        <ImportContext.Provider value={{ ...state, startImport, reset, setReviewing, dismiss }}>
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
