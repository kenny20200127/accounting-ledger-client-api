import { IsNotEmpty, IsString, Length } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  identifier: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 1024)
  password: string;
}