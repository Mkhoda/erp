import { IsEmail, IsString, MinLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  // Iranian phone in E.164 without + : 98XXXXXXXXXX (12 digits)
  @IsString()
  @Matches(/^98\d{10}$/,{message:'phone must be 12 digits starting with 98'})
  phone!: string;
}
