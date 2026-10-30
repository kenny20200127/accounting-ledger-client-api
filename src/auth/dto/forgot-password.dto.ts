import { IsNotEmpty, IsString, Length } from 'class-validator';

export class ForgotPasswordDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  identifier: string;

  @IsString()
  @Length(12, 128)
  newPassword: string;
}
