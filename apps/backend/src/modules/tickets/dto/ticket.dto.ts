import { IsString, IsOptional, IsEnum, IsArray, IsInt, IsBoolean, Min, Max, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { TicketStatus, TicketPriority } from '@prisma/client';

export class CreateTicketDto {
  @IsString() @IsNotEmpty() departmentId: string;
  @IsString() @IsNotEmpty() categoryId: string;
  @IsString() @IsNotEmpty() description: string;
  @IsOptional() @IsEnum(TicketPriority) priority?: TicketPriority;
  @IsOptional() @IsString() relatedUserId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) ccUserIds?: string[];
}

export class UpdateTicketDto {
  @IsOptional() @IsEnum(TicketStatus) status?: TicketStatus;
  @IsOptional() @IsEnum(TicketPriority) priority?: TicketPriority;
  @IsOptional() @IsString() assigneeId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) ccUserIds?: string[];
}

export class AssignTicketDto {
  @IsString() @IsNotEmpty() assigneeId: string;
}

export class TransferTicketDto {
  @IsString() @IsNotEmpty() departmentId: string;
  @IsString() @IsNotEmpty() categoryId: string;
  @IsOptional() @IsString() note?: string;
}

export class CreateCommentDto {
  @IsString() @IsNotEmpty() content: string;
  @IsOptional() @IsBoolean() isInternal?: boolean;
  @IsOptional() @IsString() replyToId?: string;
}

export class UpdateCommentDto {
  @IsString() @IsNotEmpty() content: string;
}

export class CreateCategoryDto {
  @IsString() @IsNotEmpty() configId: string;
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() @Min(0) order?: number;
  @IsOptional() @IsInt() @Min(0) slaFirstResponseHours?: number;
  @IsOptional() @IsInt() @Min(0) slaResolutionHours?: number;
}

export class UpdateCategoryDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) order?: number;
  @IsOptional() @IsInt() @Min(0) slaFirstResponseHours?: number;
  @IsOptional() @IsInt() @Min(0) slaResolutionHours?: number;
}

export class UpsertDeptConfigDto {
  @IsString() @IsNotEmpty() departmentId: string;
  @IsOptional() @IsBoolean() isEnabled?: boolean;
  @IsOptional() @IsInt() @Min(0) slaFirstResponseHours?: number;
  @IsOptional() @IsInt() @Min(0) slaResolutionHours?: number;
  @IsOptional() @IsString() workHoursStart?: string;
  @IsOptional() @IsString() workHoursEnd?: string;
  @IsOptional() @IsArray() @IsInt({ each: true }) workDays?: number[];
  @IsOptional() @IsBoolean() autoAssignRoundRobin?: boolean;
  @IsOptional() @IsBoolean() notifyOnCreate?: boolean;
  @IsOptional() @IsBoolean() notifyOnReply?: boolean;
  @IsOptional() @IsBoolean() notifyOnClose?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) managerIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) defaultAssigneeIds?: string[];
}

export class TicketFilterDto {
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsEnum(TicketStatus) status?: TicketStatus;
  @IsOptional() @IsEnum(TicketPriority) priority?: TicketPriority;
  @IsOptional() @IsString() requesterId?: string;
  @IsOptional() @IsString() assigneeId?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() dateFrom?: string;
  @IsOptional() @IsString() dateTo?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isOverSla?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}

export class UpdateTicketSettingsDto {
  @IsOptional() @IsInt() @Min(1) maxFileSizeMb?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) allowedExtensions?: string[];
  @IsOptional() @IsInt() @Min(0) autoCloseAfterDays?: number;
  @IsOptional() @IsBoolean() allowUserPriority?: boolean;
  @IsOptional() @IsString() ticketPrefix?: string;
}
