import { IsEmail, IsString, MinLength } from 'class-validator';

export class SignInCredentialsDto {
  @IsString()
  @MinLength(6, {
    message: 'Password must be more then 6 symbols',
  })
  password: string;

  @IsEmail()
  email: string;
}
