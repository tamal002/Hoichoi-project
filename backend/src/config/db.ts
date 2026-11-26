import mongoose from 'mongoose'
import { env } from './env.js'

export async function connectDatabase(): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true)
  const connection = await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  })
  console.log(`Connected to MongoDB (${connection.connection.name})`)
  return connection
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect()
}
