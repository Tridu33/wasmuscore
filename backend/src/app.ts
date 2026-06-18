// File: backend/src/app.ts
import cors from 'cors'
import express from 'express'
import fileUpload from 'express-fileupload'
import { createServer } from 'node:http'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

import { appConfig } from './2-utils/app-config'
import { tabController } from './5-controllers/tab-controller'
import { fileController } from './5-controllers/file-controller'
import { errorMiddleware } from './6-middleware/error-middleware'

const app = express()
const httpServer = createServer(app)

// Ensure upload directory exists
mkdirSync(appConfig.fileUploadDir, { recursive: true })

// Middleware
app.use(cors({ origin: true, credentials: true }))
app.use(express.json())
app.use(
  fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
    useTempFiles: false,
  }),
)

// Routes
app.use('/api', tabController)
app.use('/api', fileController)

// Error handling
app.use(errorMiddleware.routeNotFound)
app.use(errorMiddleware.catchAll)

// Start
httpServer.listen(appConfig.port, () => {
  console.log(`🎸 Backend listening on http://localhost:${appConfig.port}`)
  console.log(`   ENV: ${appConfig.isDevelopment ? 'development' : 'production'}`)
  console.log(`   Upload dir: ${appConfig.fileUploadDir}`)
})

export default app
