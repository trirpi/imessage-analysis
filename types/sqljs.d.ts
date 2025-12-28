declare module 'sql.js' {
  export interface Database {
    exec(sql: string): Array<{ columns: string[]; values: any[][] }>
    close(): void
  }

  export interface InitSqlJs {
    (config?: { locateFile?: (file: string) => string }): Promise<{
      Database: new (data?: Uint8Array) => Database
    }>
  }

  const initSqlJs: InitSqlJs
  export default initSqlJs
}

