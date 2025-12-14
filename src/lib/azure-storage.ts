import { BlobServiceClient } from '@azure/storage-blob'

if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
    // Use a dummy connection string in dev if not provided, or throw
    // console.warn("AZURE_STORAGE_CONNECTION_STRING not set")
}

// The global blobServiceClient is removed as per the edit,
// and its creation is moved inside getBlobStream for the non-local case.
// const blobServiceClient = BlobServiceClient.fromConnectionString(
//     process.env.AZURE_STORAGE_CONNECTION_STRING || "UseDevelopmentStorage=true"
// )

export const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || "certificates"

const isLocal = process.env.AZURE_STORAGE_CONNECTION_STRING === 'LOCAL'

export async function getBlobStream(blobName: string) {
    if (isLocal) {
        const { Readable } = require('stream')
        const s = new Readable()
        s.push(`Mock content for ${blobName} - generic steel cert`)
        s.push(null)
        return s
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(
        process.env.AZURE_STORAGE_CONNECTION_STRING || "UseDevelopmentStorage=true"
    )
    const containerClient = blobServiceClient.getContainerClient(containerName)
    const blobClient = containerClient.getBlobClient(blobName)

    // Check if exists
    const exists = await blobClient.exists()
    if (!exists) return null

    const downloadBlockBlobResponse = await blobClient.download()
    return downloadBlockBlobResponse.readableStreamBody
}
