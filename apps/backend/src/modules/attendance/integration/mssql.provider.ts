import { Injectable, Logger } from '@nestjs/common';
import * as sql from 'mssql';
import {
  AttendanceSourceProvider,
  RawPunchRow,
  SourceConnectionConfig,
  TestConnectionResult,
} from './source-provider.interface';

// Reads punches from a SQL Server table (default dbo.TimeRecords). The table
// name is admin-configured, so it cannot be parameterized — it is validated
// against a strict identifier pattern before being interpolated.
const TABLE_RE = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/;

@Injectable()
export class MssqlProvider implements AttendanceSourceProvider {
  readonly driver = 'mssql';
  private readonly logger = new Logger(MssqlProvider.name);

  private buildConfig(cfg: SourceConnectionConfig): sql.config {
    return {
      server: cfg.host,
      port: cfg.port,
      database: cfg.database,
      user: cfg.username,
      password: cfg.password,
      options: {
        // Legacy on-prem SQL Servers typically lack a trusted TLS cert.
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
      },
      connectionTimeout: 15000,
      requestTimeout: 30000,
      pool: { max: 4, min: 0, idleTimeoutMillis: 10000 },
    };
  }

  private safeTable(tableName: string): string {
    const t = (tableName || '').trim();
    if (!TABLE_RE.test(t)) {
      throw new Error(`نام جدول نامعتبر است: "${tableName}"`);
    }
    // Quote each part: dbo.TimeRecords → [dbo].[TimeRecords]
    return t.split('.').map((p) => `[${p}]`).join('.');
  }

  async testConnection(cfg: SourceConnectionConfig): Promise<TestConnectionResult> {
    let pool: sql.ConnectionPool | undefined;
    try {
      pool = await new sql.ConnectionPool(this.buildConfig(cfg)).connect();
      const timeRes = await pool.request().query('SELECT GETDATE() AS serverTime');
      const serverTime = timeRes.recordset?.[0]?.serverTime ?? null;

      let tableReachable = false;
      let sampleCount = 0;
      try {
        const table = this.safeTable(cfg.tableName);
        const cntRes = await pool
          .request()
          .query(`SELECT COUNT(*) AS c FROM ${table}`);
        sampleCount = Number(cntRes.recordset?.[0]?.c ?? 0);
        tableReachable = true;
      } catch (e: any) {
        return {
          ok: false,
          message: `اتصال برقرار شد اما جدول قابل خواندن نیست: ${e.message}`,
          serverTime,
          tableReachable: false,
        };
      }

      return {
        ok: true,
        message: 'اتصال با موفقیت برقرار شد',
        serverTime,
        tableReachable,
        sampleCount,
      };
    } catch (e: any) {
      return { ok: false, message: `خطای اتصال: ${e.message}` };
    } finally {
      await pool?.close().catch(() => undefined);
    }
  }

  async fetchSince(
    cfg: SourceConnectionConfig,
    afterRecordId: number,
    limit: number,
  ): Promise<RawPunchRow[]> {
    let pool: sql.ConnectionPool | undefined;
    try {
      pool = await new sql.ConnectionPool(this.buildConfig(cfg)).connect();
      const table = this.safeTable(cfg.tableName);
      const result = await pool
        .request()
        .input('after', sql.Int, afterRecordId)
        .input('lim', sql.Int, Math.max(1, Math.min(limit, 10000)))
        .query(
          `SELECT TOP (@lim) RecordID, CardNo, mDate, sDate, RTime, RType, DeviceCode
           FROM ${table}
           WHERE RecordID > @after
           ORDER BY RecordID ASC`,
        );
      return (result.recordset || []).map((r: any) => ({
        recordId: Number(r.RecordID),
        cardNo: String(r.CardNo ?? '').trim(),
        mDate: r.mDate != null ? String(r.mDate) : null,
        sDate: r.sDate != null ? String(r.sDate) : null,
        rTime: r.RTime != null ? String(r.RTime) : null,
        rType: r.RType != null ? String(r.RType) : null,
        deviceCode: r.DeviceCode != null ? String(r.DeviceCode) : null,
      }));
    } finally {
      await pool?.close().catch(() => undefined);
    }
  }
}
