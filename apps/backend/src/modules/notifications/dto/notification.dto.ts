import { IsString, IsOptional, IsEnum, IsArray, IsBoolean, IsInt, Min, Max, IsNotEmpty, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationCategory, NotificationPriority, AnnouncementType, AnnouncementTarget } from '@prisma/client';

export class PublishNotificationDto {
  @IsArray() @IsString({ each: true }) userIds: string[];
  @IsEnum(NotificationCategory) category: NotificationCategory;
  @IsEnum(NotificationPriority) @IsOptional() priority?: NotificationPriority;
  @IsString() @IsNotEmpty() title: string;
  @IsString() @IsNotEmpty() body: string;
  @IsString() @IsOptional() link?: string;
  @IsString() @IsOptional() icon?: string;
  @IsString() @IsOptional() sourceModule?: string;
  @IsString() @IsOptional() sourceId?: string;
}

export class NotificationFilterDto {
  @IsOptional() @IsEnum(NotificationCategory) category?: NotificationCategory;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isRead?: boolean;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isArchived?: boolean;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isPinned?: boolean;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class MarkReadDto {
  @IsArray() @IsString({ each: true }) ids: string[];
}

export class CreateAnnouncementDto {
  @IsString() @IsNotEmpty() title: string;
  @IsString() @IsNotEmpty() body: string;
  @IsEnum(AnnouncementType) @IsOptional() type?: AnnouncementType;
  @IsEnum(NotificationPriority) @IsOptional() priority?: NotificationPriority;
  @IsEnum(AnnouncementTarget) @IsOptional() targetType?: AnnouncementTarget;
  @IsArray() @IsString({ each: true }) @IsOptional() targetDeptIds?: string[];
  @IsArray() @IsString({ each: true }) @IsOptional() targetRoles?: string[];
  @IsArray() @IsString({ each: true }) @IsOptional() targetUserIds?: string[];
  @IsBoolean() @IsOptional() isSticky?: boolean;
  @IsBoolean() @IsOptional() isPinned?: boolean;
  @IsDateString() @IsOptional() publishAt?: string;
  @IsDateString() @IsOptional() expireAt?: string;
  @IsBoolean() @IsOptional() showOnce?: boolean;
  @IsBoolean() @IsOptional() showUntilAck?: boolean;
}

export class UpdateAnnouncementDto {
  @IsString() @IsOptional() title?: string;
  @IsString() @IsOptional() body?: string;
  @IsEnum(AnnouncementType) @IsOptional() type?: AnnouncementType;
  @IsEnum(NotificationPriority) @IsOptional() priority?: NotificationPriority;
  @IsEnum(AnnouncementTarget) @IsOptional() targetType?: AnnouncementTarget;
  @IsArray() @IsString({ each: true }) @IsOptional() targetDeptIds?: string[];
  @IsArray() @IsString({ each: true }) @IsOptional() targetRoles?: string[];
  @IsArray() @IsString({ each: true }) @IsOptional() targetUserIds?: string[];
  @IsBoolean() @IsOptional() isSticky?: boolean;
  @IsBoolean() @IsOptional() isPinned?: boolean;
  @IsBoolean() @IsOptional() isPublished?: boolean;
  @IsDateString() @IsOptional() publishAt?: string;
  @IsDateString() @IsOptional() expireAt?: string;
  @IsBoolean() @IsOptional() showOnce?: boolean;
  @IsBoolean() @IsOptional() showUntilAck?: boolean;
}

export class AnnouncementFilterDto {
  @IsOptional() @IsEnum(AnnouncementType) type?: AnnouncementType;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isPublished?: boolean;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
