const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
console.log('PartPiece fields:', Object.keys(prisma.partPiece.fields))
prisma.$disconnect()
