import { defineConfig } from '@prisma/config'

export default defineConfig({
    datasource: {
        url: process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_PRISMA_URL
    }
})
