// File: backend/src/5-controllers/tab-controller.ts
import express from 'express'
import type { Request, Response, NextFunction } from 'express'
import { tabService } from '../4-services/tab-service'

export const tabController = express.Router()

// GET /api/tabs - 获取所有乐谱
async function getAll(_req: Request, res: Response, next: NextFunction) {
  try {
    const tabs = await tabService.getAllTabs()
    res.json(tabs)
  }
  catch (err) {
    next(err)
  }
}

// GET /api/tabs/search?q=... - 搜索乐谱
async function search(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query.q as string
    if (!q) {
      res.status(400).json({ error: 'Missing query parameter "q"' })
      return
    }
    const tabs = await tabService.searchTabs(q)
    res.json(tabs)
  }
  catch (err) {
    next(err)
  }
}

// GET /api/tabs/:id - 获取单个乐谱
async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id)
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid tab ID' })
      return
    }
    const tab = await tabService.getTabById(id)
    if (!tab) {
      res.status(404).json({ error: 'Tab not found' })
      return
    }
    res.json(tab)
  }
  catch (err) {
    next(err)
  }
}

// DELETE /api/tabs/:id - 删除乐谱
async function deleteTab(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id)
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid tab ID' })
      return
    }
    await tabService.deleteTab(id)
    res.json({ success: true })
  }
  catch (err) {
    next(err)
  }
}

tabController.get('/tabs', getAll)
tabController.get('/tabs/search', search)
tabController.get('/tabs/:id', getById)
tabController.delete('/tabs/:id', deleteTab)
