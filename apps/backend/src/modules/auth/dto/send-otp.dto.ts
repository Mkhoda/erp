import { IsIn, IsNotEmpty, IsString, Matches } from 'class-validator';

export class SendOtpDto {
  @IsString()
  @IsNotEmpty()
  // must be normalized to 98xxxxxxxxxx
  @Matches(/^98\d{10}$/)
  phone!: string;

  @IsString()
  @IsIn(['login', 'forgot', 'change', 'signup'])
  purpose!: 'login' | 'forgot' | 'change' | 'signup';
}
