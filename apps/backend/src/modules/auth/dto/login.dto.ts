import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'ایمیل معتبر وارد کنید' })
  email!: string;

  @IsString()
  @MinLength(6, { message: 'رمز عبور باید حداقل ۶ کاراکتر باشد' })
  password!: string;
}
