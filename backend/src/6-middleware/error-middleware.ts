// File: backend/src/6-middleware/error-middleware.ts
import type { Request, Response, NextFunction } from 'express'

class ErrorMiddleware {
  public routeNotFound(req: Request, res: Response, next: NextFunction) {
    res.status(404).json({
      error: `Route ${req.method} ${req.originalUrl} not found`,
    })
  }

  public catchAll(err: Error, _req: Request, res: Response, _next: NextFunction) {
    console.error('[ERROR]', err)
    res.status(500).json({
      error: err.message || 'Internal server error',
    })
  }
}

export const errorMiddleware = new ErrorMiddleware()
