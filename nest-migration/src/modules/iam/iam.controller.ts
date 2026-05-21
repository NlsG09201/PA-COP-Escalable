import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
  Headers,
  ForbiddenException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { IamService } from './iam.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterPublicDto } from './dto/register-public.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { BootstrapAdminService } from './bootstrap-admin.service';

@ApiTags('auth')
@Controller('api/auth')
export class IamController {
  constructor(
    private readonly iamService: IamService,
    private readonly bootstrapAdmin: BootstrapAdminService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Public patient registration' })
  async register(@Body() dto: RegisterPublicDto, @Req() req: Request) {
    return this.iamService.registerPublicPatient(dto, req.ip, req.headers['user-agent']);
  }

  @Post('google')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login or register with Google (Gmail)' })
  async google(@Body() dto: GoogleAuthDto, @Req() req: Request) {
    return this.iamService.loginOrRegisterWithGoogle(dto, req.ip, req.headers['user-agent']);
  }

  @Post('login')
  @Throttle({ default: { limit: 25, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    return this.iamService.login(loginDto, req.ip, req.headers['user-agent']);
  }

  /** Crear/resetear admin con APP_BOOTSTRAP_* (solo si SETUP_ADMIN_SECRET coincide). */
  @Post('setup-bootstrap')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'One-time bootstrap admin (requires X-COP-Setup-Secret)' })
  async setupBootstrap(@Headers('x-cop-setup-secret') secret?: string) {
    const expected = (process.env.SETUP_ADMIN_SECRET ?? '').trim();
    if (!expected || secret !== expected) {
      throw new ForbiddenException('Invalid setup secret');
    }
    const result = await this.bootstrapAdmin.forceBootstrapAdmin();
    return {
      ok: true,
      ...result,
      message: 'Admin listo. Inicia sesión con APP_BOOTSTRAP_ADMIN_USERNAME y APP_BOOTSTRAP_ADMIN_PASSWORD.',
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout: revoke current access token' })
  async logout(@Headers('authorization') authorization?: string) {
    return this.iamService.logout(authorization);
  }

  @Post('refresh')
  @Throttle({ default: { limit: 45, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token' })
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.iamService.refreshToken(dto.refreshToken, req.ip, req.headers['user-agent']);
  }
}
