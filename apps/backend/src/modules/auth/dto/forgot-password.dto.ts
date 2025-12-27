import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^98\d{10}$/)
  phone!: string;

  @IsString()
  @Matches(/^\d{6}$/)
  otp!: string;

  @IsString()
  @MinLength(6)
  newPassword!: string;
}
