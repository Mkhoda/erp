import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^98\d{10}$/)
  phone!: string;

  @IsString()
  @Matches(/^\d{6}$/)
  otp!: string;
}
