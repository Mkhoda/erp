// Generic attendance-source abstraction. New device backends (MySQL, HTTP,
// CSV, …) implement this interface so the sync engine never changes.

export interface SourceConnectionConfig {
  driver: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string; // decrypted
  tableName: string;
  timeZone: string;
}

// One punch row as received from the device DB (column names mirror dbo.TimeRecords).
export interface RawPunchRow {
  recordId: number;
  cardNo: string;
  mDate?: string | null;
  sDate?: string | null;
  rTime?: string | null;
  rType?: string | null;
  deviceCode?: string | null;
}

export interface TestConnectionResult {
  ok: boolean;
  message: string;
  serverTime?: Date | null;
  tableReachable?: boolean;
  sampleCount?: number;
}

export interface AttendanceSourceProvider {
  readonly driver: string;
  testConnection(cfg: SourceConnectionConfig): Promise<TestConnectionResult>;
  // Incremental read: rows with RecordID > afterRecordId, ascending, capped at `limit`.
  fetchSince(cfg: SourceConnectionConfig, afterRecordId: number, limit: number): Promise<RawPunchRow[]>;
}
