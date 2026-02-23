import { IsString, MinLength } from 'class-validator';

export class LoginByPhoneDto {
  @IsString()
  phone!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
