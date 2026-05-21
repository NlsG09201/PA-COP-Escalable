import {
  Controller,
  Post,
  Get,
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
import { SetupBootstrapDto } from './dto/setup-bootstrap.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterPublicDto } from './dto/register-public.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { BootstrapAdminService } from './bootstrap-admin.service';
import { AtlasBulkSeedService } from './atlas-bulk-seed.service';

@ApiTags('auth')
@Controller('api/auth')
export class IamController {
  constructor(
    private readonly iamService: IamService,
    private readonly bootstrapAdmin: BootstrapAdminService,
    private readonly atlasBulkSeed: AtlasBulkSeedService,
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
  async setupBootstrap(
    @Headers('x-cop-setup-secret') secret?: string,
    @Body() body?: SetupBootstrapDto,
  ) {
    const configured = (process.env.SETUP_ADMIN_SECRET ?? '').trim();
    const allowed = new Set(
      [configured || 'cop-atlas-setup-2026', (process.env.APP_BOOTSTRAP_ADMIN_PASSWORD ?? '').trim()].filter(Boolean),
    );
    if (!secret || !allowed.has(secret)) {
      throw new ForbiddenException('Invalid setup secret');
    }
    const result = await this.bootstrapAdmin.forceBootstrapAdmin(body?.password);
    if (!result.verified) {
      throw new ForbiddenException(
        'Admin guardado pero la verificación de contraseña falló. Revisa APP_BOOTSTRAP_ADMIN_PASSWORD o envía { "password": "..." } en el body.',
      );
    }
    return { ok: true, username: result.username, action: result.action, verified: result.verified };
  }

  /**
   * Sin secreto: solo si no hay admin o la contraseña del bootstrap no coincide con APP_BOOTSTRAP_*.
   * Arregla login 401 cuando Atlas/Render no crearon el admin al arrancar.
   */
  @Post('ensure-bootstrap')
  @Throttle({ default: { limit: 3, ttl: 300000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Auto-repair bootstrap admin when missing or wrong password' })
  async ensureBootstrap() {
    const allowed = await this.bootstrapAdmin.canAutoEnsureBootstrap();
    if (!allowed) {
      const status = await this.bootstrapAdmin.getBootstrapStatus();
      throw new ForbiddenException({
        message:
          'Bootstrap auto-repair not allowed. Usa la contraseña de APP_BOOTSTRAP_ADMIN_PASSWORD en Render o POST setup-bootstrap.',
        status,
      });
    }
    const result = await this.bootstrapAdmin.forceBootstrapAdmin();
    if (!result.verified) {
      throw new ForbiddenException({
        message: 'Bootstrap ejecutado pero login no verificado. Usa POST setup-bootstrap con body { "password": "Nelson09092001" }.',
        ...result,
      });
    }
    return { ok: true, username: result.username, action: result.action, verified: result.verified };
  }

  @Get('bootstrap-status')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Diagnose bootstrap admin / login 401 (no secrets)' })
  async bootstrapStatus() {
    return this.bootstrapAdmin.getBootstrapStatus();
  }

  /** Estado mínimo del login (sin usuarios ni rutas internas en producción). */
  @Get('login-help')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Login form hints (no secrets)' })
  async loginHelp() {
    const status = await this.bootstrapAdmin.getBootstrapStatus();
    const isProd = process.env.NODE_ENV === 'production';
    const adminReady =
      status.bootstrapUserExists &&
      status.bootstrapPasswordMatchesEnv &&
      status.bootstrapDuplicateCount <= 1;

    if (isProd) {
      return { requireSite: true, adminReady };
    }

    const username = (process.env.APP_BOOTSTRAP_ADMIN_USERNAME ?? '').toLowerCase().trim();
    const email = String(process.env.APP_BOOTSTRAP_ADMIN_EMAIL ?? '').trim().toLowerCase();
    return {
      loginIds: [username, email].filter(Boolean),
      requireSite: true,
      adminReady,
      bootstrapDuplicateCount: status.bootstrapDuplicateCount,
    };
  }

  /** Carga 15.000 pacientes + 15.000 j48_predictions (dataset ARFF) en Atlas. */
  @Post('seed-bulk-15k')
  @Throttle({ default: { limit: 2, ttl: 600000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Seed 15k patients + 15k J48 predictions (requires X-COP-Setup-Secret)' })
  async seedBulk15k(
    @Headers('x-cop-setup-secret') secret?: string,
    @Body() body?: { forzar?: boolean },
  ) {
    const configured = (process.env.SETUP_ADMIN_SECRET ?? '').trim();
    const allowed = new Set(
      [configured || 'cop-atlas-setup-2026', (process.env.APP_BOOTSTRAP_ADMIN_PASSWORD ?? '').trim()].filter(Boolean),
    );
    if (!secret || !allowed.has(secret)) {
      throw new ForbiddenException('Invalid setup secret');
    }
    return this.atlasBulkSeed.seedBulk15k({ forzar: !!body?.forzar });
  }

  /** 35.000 pacientes (17.5k odonto + 17.5k psico) + catálogo de servicios con precios COP. */
  @Post('seed-bulk-35k-catalog')
  @Throttle({ default: { limit: 2, ttl: 900000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Seed 35k patients + service catalog (requires X-COP-Setup-Secret)' })
  async seedBulk35kCatalog(
    @Headers('x-cop-setup-secret') secret?: string,
    @Body() body?: { forzar?: boolean; soloCatalogo?: boolean; soloPacientes?: boolean },
  ) {
    const configured = (process.env.SETUP_ADMIN_SECRET ?? '').trim();
    const allowed = new Set(
      [configured || 'cop-atlas-setup-2026', (process.env.APP_BOOTSTRAP_ADMIN_PASSWORD ?? '').trim()].filter(Boolean),
    );
    if (!secret || !allowed.has(secret)) {
      throw new ForbiddenException('Invalid setup secret');
    }
    return this.atlasBulkSeed.seedBulk35kAndCatalog({
      forzar: !!body?.forzar,
      soloCatalogo: !!body?.soloCatalogo,
      soloPacientes: !!body?.soloPacientes,
    });
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
