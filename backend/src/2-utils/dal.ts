// File: backend/src/2-utils/dal.ts
import mysql from 'mysql2'
import { appConfig } from './app-config'

class DAL {
  private pool = mysql.createPool({
    host: appConfig.mysqlHost,
    user: appConfig.mysqlUser,
    password: appConfig.mysqlPassword,
    database: appConfig.mysqlDatabase,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  })

  public async execute<T = any>(sql: string, values?: any[]): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pool.query(sql, values, (err, results) => {
        if (err) {
          reject(err)
          return
        }
        resolve(results as T)
      })
    })
  }
}

export const dal = new DAL()
