import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Post('company/login')
  companyLogin(@Body() dto: LoginDto) {
    return this.auth.login(dto, 'company');
  }

  @Public()
  @Post('platform/login')
  platformLogin(@Body() dto: LoginDto) {
    return this.auth.login(dto, 'platform');
  }

  @Get('me')
  me(@Req() request: { user: { sub: string } }) {
    return this.auth.getProfile(request.user.sub);
  }

  @Get('menus')
  menus(@Req() request: { user: { sub: string } }) {
    return this.auth.getUserMenus(request.user.sub);
  }

  @Public()
  @Get('menus/public')
  publicMenus() {
    return this.auth.getAllMenus();
  }
}
