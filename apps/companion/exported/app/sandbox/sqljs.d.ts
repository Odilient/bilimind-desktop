/**
 * Minimal ambient types for `sql.js` (which ships no `.d.ts`). Only the surface
 * the sandbox worker touches is declared. See runner.worker.ts.
 */
declare module 'sql.js' {
  export interface QueryExecResult {
    columns: string[]
    values: unknown[][]
  }

  export interface SqlJsDatabase {
    exec(sql: string): QueryExecResult[]
    run(sql: string): SqlJsDatabase
    close(): void
  }

  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => SqlJsDatabase
  }

  export interface InitSqlJsConfig {
    locateFile?: (file: string) => string
  }

  const initSqlJs: (config?: InitSqlJsConfig) => Promise<SqlJsStatic>
  export default initSqlJs
}
