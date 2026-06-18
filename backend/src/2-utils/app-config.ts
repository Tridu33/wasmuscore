// File: backend/src/2-utils/app-config.ts
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

class AppConfig {
  public readonly isDevelopment = process.env.ENVIRONMENT === 'development'
  public readonly isProduction = process.env.ENVIRONMENT === 'production'
  public readonly port = Number(process.env.PORT || 13030)

  // MySQL
  public readonly mysqlHost = process.env.MYSQL_HOST || 'localhost'
  public readonly mysqlUser = process.env.MYSQL_USER || 'root'
  public readonly mysqlPassword = process.env.MYSQL_PASSWORD || ''
  public readonly mysqlDatabase = process.env.MYSQL_DATABASE || 'wascore_tabs'

  // File upload
  public readonly fileUploadDir = path.resolve(
    __dirname,
    '..',
    process.env.FILE_UPLOAD_DIR || './1-assets/uploads',
  )
}

export const appConfig = new AppConfig()
