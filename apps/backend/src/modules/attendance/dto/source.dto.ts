import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpsertSourceDto {
  @IsString() @MinLength(1) @MaxLength(120)
  name!: string;

  @IsOptional() @IsString()
  driver?: string;

  @IsString() @MinLength(1)
  host!: string;

  @IsOptional() @IsInt() @Min(1) @Max(65535)
  port?: number;

  @IsString() @MinLength(1)
  database!: string;

  @IsString() @MinLength(1)
  username!: string;

  // Optional on update — omit/empty keeps the stored password unchanged.
  @IsOptional() @IsString()
  password?: string;

  @IsOptional() @IsString()
  tableName?: string;

  @IsOptional() @IsString()
  timeZone?: string;

  @IsOptional() @IsBoolean()
  syncEnabled?: boolean;

  @IsOptional() @IsInt() @Min(30) @Max(86400)
  syncIntervalSec?: number;

  @IsOptional() @IsInt() @Min(1) @Max(10000)
  batchSize?: number;

  @IsOptional() @IsString()
  initialSyncDate?: string;

  @IsOptional() @IsInt() @Min(0)
  initialRecordId?: number;

  @IsOptional() @IsBoolean()
  autoRetry?: boolean;

  @IsOptional() @IsInt() @Min(0) @Max(10)
  retryCount?: number;
}

export class UpsertDeviceDto {
  @IsString() @MinLength(1)
  deviceCode!: string;

  @IsString() @MinLength(1)
  name!: string;

  @IsOptional() @IsString()
  direction?: 'IN' | 'OUT' | 'UNKNOWN';

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
