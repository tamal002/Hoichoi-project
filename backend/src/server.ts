import { createApp } from './app.js'
import { connectDatabase, disconnectDatabase } from './config/db.js'
import { env } from './config/env.js'
import { seedDatabaseIfEmpty } from './services/seed.service.js'

async function start() {
  await connectDatabase()
  await seedDatabaseIfEmpty()

  const app = createApp()
  const server = app.listen(env.PORT, () => {
    console.log(`Nexboard backend listening on http://localhost:${env.PORT}`)
  })

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down...`)
    server.close(async () => {
      await disconnectDatabase()
      process.exit(0)
    })
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

start().catch((error) => {
  console.error('Failed to start backend:', error)
  process.exit(1)
})
