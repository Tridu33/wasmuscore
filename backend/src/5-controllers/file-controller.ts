// File: backend/src/5-controllers/file-controller.ts
import express from 'express'
import type { Request, Response, NextFunction } from 'express'
import { join, basename, extname } from 'node:path'
import { existsSync, renameSync } from 'node:fs'
import { appConfig } from '../2-utils/app-config'
import { tabService } from '../4-services/tab-service'
import { gpParserService } from '../4-services/gp-parser-service'

export const fileController = express.Router()

// POST /api/tabs/upload - 上传 GP 文件
async function uploadFile(req: Request, res: Response, next: NextFunction) {
  try {
    const file = req.files?.file as { data: Buffer; name: string; mv: (dest: string) => Promise<void> } | undefined
    if (!file) {
      res.status(400).json({ error: 'No file uploaded' })
      return
    }

    const safeName = basename(file.name)
    const fileType = extname(safeName).toLowerCase()
    const destPath = join(appConfig.fileUploadDir, safeName)

    // Save file
    await file.mv(destPath)

    // Parse GP metadata
    let gpMeta: Record<string, any> | undefined
    try {
      const parsed = gpParserService.parseFromFile(destPath)
      gpMeta = gpParserService.extractMetadata(parsed)
    }
    catch (parseErr) {
      console.warn('GP parse warning:', parseErr)
    }

    // Create DB record
    const tabName = gpMeta?.title || safeName.replace(/\.[^.]+$/, '')
    const id = await tabService.createTab({
      name: tabName,
      songName: gpMeta?.artist || '',
      bandName: '',
      fileType,
      filePath: destPath,
      downloadUrl: `/api/tabs/file/${safeName}`,
      gpMetadata: gpMeta,
    })

    res.json({
      id,
      name: tabName,
      songName: gpMeta?.title || '',
      bandName: gpMeta?.artist || '',
      fileType,
      downloadUrl: `/api/tabs/file/${safeName}`,
      gpMetadata: gpMeta,
    })
  }
  catch (err) {
    next(err)
  }
}

// GET /api/tabs/file/:fileName - 下载 GP 文件
function downloadFile(req: Request, res: Response) {
  const fileName = basename(req.params.fileName)
  const filePath = join(appConfig.fileUploadDir, fileName)

  if (!existsSync(filePath)) {
    res.status(404).json({ error: 'File not found' })
    return
  }

  res.download(filePath, fileName)
}

// GET /api/tabs/recent - 最近上传的乐谱
async function getRecent(_req: Request, res: Response, next: NextFunction) {
  try {
    const tabs = await tabService.getAllTabs()
    res.json(tabs.slice(0, 20))
  }
  catch (err) {
    next(err)
  }
}

fileController.post('/tabs/upload', uploadFile)
fileController.get('/tabs/file/:fileName', downloadFile)
fileController.get('/tabs/recent', getRecent)
