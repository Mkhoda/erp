import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @Matches(/^\d{6}$/)
  otp!: string;

  @IsString()
  @MinLength(6)
  newPassword!: string;
}
