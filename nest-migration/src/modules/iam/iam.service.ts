import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AssignRoleDto } from './dto/assign-role.dto';
import { SUPER_ADMIN_ROLE } from './roles.constants';
import { JwtService } from '@nestjs/jwt';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { UUID } from 'bson';
import * as crypto from 'crypto';
import Redis from 'ioredis';
import { Model } from 'mongoose';
import { Connection } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { UserAccount } from './user-account.schema';
import { RefreshToken } from './schemas/refresh-token.schema';
import { LoginDto } from './dto/login.dto';
import { RegisterPublicDto } from './dto/register-public.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { Inject } from '@nestjs/common';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class IamService {
  constructor(
    @InjectModel(UserAccount.name) private userModel: Model<UserAccount>,
    @InjectModel(RefreshToken.name) private refreshModel: Model<RefreshToken>,
    private jwtService: JwtService,
    @InjectConnection() private readonly connection: Connection,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  private asUuid(value?: string): UUID | undefined {
    if (!value) return undefined;
    try {
      return new UUID(String(value));
    } catch {
      return undefined;
    }
  }

  private asStringId(value: any): string {
    if (!value) return '';
    try {
      return typeof value === 'string' ? value : value.toString();
    } catch {
      return String(value);
    }
  }

  async loginOrRegisterWithGoogle(dto: GoogleAuthDto, ip?: string, userAgent?: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!clientId) {
      throw new BadRequestException(
        'Inicio con Google no configurado. Define GOOGLE_CLIENT_ID o usa registro manual con tu correo Gmail.',
      );
    }

    const tokenInfoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(dto.idToken)}`,
    );
    if (!tokenInfoRes.ok) throw new UnauthorizedException('Token de Google inválido');
    const tokenInfo = (await tokenInfoRes.json()) as { aud?: string; email?: string; name?: string; sub?: string };
    if (tokenInfo.aud !== clientId) throw new UnauthorizedException('Token de Google no corresponde a esta aplicación');

    const email = String(tokenInfo.email ?? '').trim().toLowerCase();
    if (!email) throw new BadRequestException('La cuenta de Google no tiene correo verificado');

    const existing = await this.userModel.findOne({ username: email }).exec();
    if (existing) {
      return this.generateTokenPair(existing, dto.siteId, ip, userAgent);
    }

    if (!dto.siteId) throw new BadRequestException('siteId requerido para el primer registro con Google');

    const randomPassword = crypto.randomBytes(24).toString('base64url');
    return this.registerPublicPatient(
      {
        siteId: dto.siteId,
        email,
        password: randomPassword,
        fullName: String(tokenInfo.name ?? email.split('@')[0]),
        phone: '',
      },
      ip,
      userAgent,
    );
  }

  async registerPublicPatient(dto: RegisterPublicDto, ip?: string, userAgent?: string) {
    const siteUuid = this.asUuid(dto.siteId);
    if (!siteUuid) throw new BadRequestException('siteId must be a valid UUID');

    const email = String(dto.email ?? '').trim().toLowerCase();
    const username = email;
    const fullName = String(dto.fullName ?? '').trim();
    const phone = String(dto.phone ?? '').trim();

    const site = await this.connection.collection<any>('sites').findOne({ _id: siteUuid as any } as any);
    if (!site) throw new BadRequestException('siteId not found');

    // Create patient in legacy `patients` collection (UUID binary ids).
    const patientId = new UUID(crypto.randomUUID());
    const patientDoc: any = {
      _id: patientId,
      organization_id: site.organization_id,
      site_id: site._id,
      external_code: null,
      full_name: fullName,
      birth_date: dto.birthDate ? new Date(`${dto.birthDate}T00:00:00.000Z`) : null,
      gender: dto.gender ?? null,
      phone: phone || null,
      email: email || null,
      status: 'ACTIVE',
      created_at: new Date(),
      updated_at: new Date(),
    };
    if (patientDoc.birth_date && Number.isNaN(patientDoc.birth_date.getTime())) {
      throw new BadRequestException('birthDate must be YYYY-MM-DD');
    }

    // Ensure no existing user for email.
    const existing = await this.userModel.findOne({ username }).exec();
    if (existing) throw new BadRequestException('user already exists');

    await this.connection.collection<any>('patients').insertOne(patientDoc);

    const password_hash = await bcrypt.hash(dto.password, 12);
    const user = await this.userModel.create({
      organization_id: this.asStringId(site.organization_id),
      username,
      password_hash,
      patient_id: this.asStringId(patientId),
      roles: ['PACIENTE'],
      mfa_enabled: false,
    } as any);

    return this.generateTokenPair(user, this.asStringId(site._id), ip, userAgent);
  }

  async login(dto: LoginDto, ip?: string, userAgent?: string) {
    const loginId = dto.username.toLowerCase().trim();
    let user = await this.userModel.findOne({ username: loginId }).exec();
    if (!user && loginId.includes('@')) {
      user = await this.userModel.findOne({ email: loginId }).exec();
    }
    const storedHash = user?.password_hash ? this.normalizeHash(user.password_hash) : '';
    if (!user || !storedHash || !(await bcrypt.compare(dto.password, storedHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokenPair(user, dto.siteId, ip, userAgent);
  }

  async logout(authorization?: string) {
    const token = String(authorization ?? '').startsWith('Bearer ') ? String(authorization).slice('Bearer '.length).trim() : '';
    if (!token) throw new UnauthorizedException('Missing token');

    const payload: any = this.jwtService.decode(token);
    if (!payload?.jti || !payload?.exp) throw new UnauthorizedException('Invalid token');

    const ttlSeconds = Math.max(1, Number(payload.exp) - Math.floor(Date.now() / 1000));
    await this.redis.set(`bl:${String(payload.jti)}`, '1', 'EX', ttlSeconds);
    return { ok: true };
  }

  async listUsersForAdmin(search?: string, limit = 50) {
    const cap = Math.min(200, Math.max(1, Number(limit) || 50));
    const q = String(search ?? '').trim().toLowerCase();
    const filter: Record<string, unknown> = {};
    if (q) {
      filter.$or = [
        { username: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { email: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      ];
    }
    const rows = await this.userModel
      .find(filter)
      .sort({ username: 1 })
      .limit(cap)
      .select('username email roles organization_id patient_id')
      .lean()
      .exec();
    return rows.map((u: any) => ({
      id: String(u._id),
      username: u.username,
      email: u.email ?? null,
      roles: u.roles ?? [],
      organizationId: u.organization_id ?? null,
      patientId: u.patient_id ?? null,
    }));
  }

  async assignRoleToUser(actor: { roles?: string[]; organization_id?: string }, dto: AssignRoleDto) {
    const actorRoles = Array.isArray(actor?.roles) ? actor.roles : [];
    const isSuper = actorRoles.includes(SUPER_ADMIN_ROLE);
    const isAdmin = actorRoles.includes('ADMIN') || isSuper;
    if (!isAdmin) throw new ForbiddenException('Solo administradores pueden asignar roles');

    const username = String(dto.username ?? '').trim().toLowerCase();
    const target = await this.userModel.findOne({ username }).exec();
    if (!target) throw new BadRequestException('Usuario no encontrado. Debe registrarse primero en la web pública.');

    if (!isSuper && String(target.organization_id) !== String(actor.organization_id ?? '')) {
      throw new ForbiddenException('No puedes asignar roles fuera de tu organización');
    }

    const role = String(dto.role);
    const elevated = ['ADMIN', 'ORG_ADMIN', 'SITE_ADMIN'];
    if (elevated.includes(role) && !isSuper) {
      throw new ForbiddenException('Solo SUPER_ADMIN puede asignar roles administrativos');
    }

    const nextRoles = Array.from(new Set([...(target.roles ?? []).filter((r) => r !== 'PACIENTE'), role]));
    if (role === 'PACIENTE') {
      target.roles = ['PACIENTE'];
    } else {
      target.roles = nextRoles;
    }
    await target.save();

    return {
      ok: true,
      username: target.username,
      roles: target.roles,
      message:
        role === 'MEDICO' || role === 'PROFESSIONAL'
          ? 'Rol clínico asignado. El usuario ya puede ingresar al dashboard.'
          : 'Rol actualizado.',
    };
  }

  async getMyProfile(user: any) {
    const roles = Array.isArray(user?.roles) ? user.roles : [];
    const username = String(user?.username ?? '');

    const account = await this.userModel.findOne({ username }).exec();
    const base = {
      id: account?._id ?? user?.userId,
      username,
      roles,
      organization_id: String(user?.organization_id ?? ''),
      site_id: user?.site_id ? String(user.site_id) : undefined,
    };

    const patientIdStr = account?.patient_id ? String(account.patient_id) : '';
    const patientUuid = this.asUuid(patientIdStr);
    if (!patientUuid) return { ...base, profile: null };

    const patient = await this.connection.collection<any>('patients').findOne({ _id: patientUuid as any } as any);
    if (!patient) return { ...base, profile: null };

    return {
      ...base,
      profile: {
        patientId: patientIdStr,
        fullName: patient.full_name ?? null,
        email: patient.email ?? null,
        phone: patient.phone ?? null,
        birthDate: patient.birth_date ? new Date(patient.birth_date).toISOString().slice(0, 10) : null,
        gender: patient.gender ?? null,
      },
    };
  }

  async updateMyProfile(user: any, dto: UpdateProfileDto) {
    const username = String(user?.username ?? '');
    const account = await this.userModel.findOne({ username }).exec();
    if (!account) throw new UnauthorizedException('User not found');

    const patientIdStr = account.patient_id ? String(account.patient_id) : '';
    const patientUuid = this.asUuid(patientIdStr);
    if (!patientUuid) throw new BadRequestException('Profile not linked to a patient');

    const patch: any = { updated_at: new Date() };
    if (dto.fullName !== undefined) patch.full_name = String(dto.fullName ?? '').trim();
    if (dto.phone !== undefined) patch.phone = String(dto.phone ?? '').trim() || null;
    if (dto.email !== undefined) patch.email = String(dto.email ?? '').trim().toLowerCase() || null;
    if (dto.gender !== undefined) patch.gender = dto.gender ?? null;
    if (dto.birthDate !== undefined) {
      if (!dto.birthDate) patch.birth_date = null;
      else {
        const d = new Date(`${dto.birthDate}T00:00:00.000Z`);
        if (Number.isNaN(d.getTime())) throw new BadRequestException('birthDate must be YYYY-MM-DD');
        patch.birth_date = d;
      }
    }

    await this.connection.collection<any>('patients').updateOne({ _id: patientUuid as any } as any, { $set: patch });

    // If email changed: update username too (we use email as username).
    if (dto.email) {
      const newUsername = String(dto.email).trim().toLowerCase();
      if (newUsername && newUsername !== account.username) {
        const exists = await this.userModel.findOne({ username: newUsername }).exec();
        if (exists) throw new BadRequestException('email already in use');
        account.username = newUsername;
      }
    }

    if (dto.password) {
      account.password_hash = await bcrypt.hash(dto.password, 12);
    }

    await account.save();

    return this.getMyProfile({ ...user, username: account.username });
  }

  async refreshToken(token: string, ip?: string, userAgent?: string) {
    const trimmed = typeof token === 'string' ? token.trim() : '';
    if (!trimmed) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const hash = this.hashToken(trimmed);
    const storedToken = await this.refreshModel.findOne({ token_hash: hash }).exec();

    if (!storedToken || storedToken.expires_at < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.userModel.findById(storedToken.user_id).exec();
    if (!user) throw new UnauthorizedException('User not found');

    // Rotate token: delete old, issue new
    await storedToken.deleteOne();
    return this.generateTokenPair(user, storedToken.site_id, ip, userAgent);
  }

  private async generateTokenPair(user: UserAccount, siteId?: string, ip?: string, userAgent?: string) {
    const jti = crypto.randomUUID();
    const payload = {
      sub: user.username,
      user_id: user._id,
      organization_id: user.organization_id,
      site_id: siteId,
      roles: user.roles,
      jti,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = require('crypto').randomBytes(40).toString('hex');
    const refreshHash = this.hashToken(refreshToken);

    const refreshDoc = new this.refreshModel({
      user_id: user._id,
      organization_id: user.organization_id,
      site_id: siteId,
      token_hash: refreshHash,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      ip_address: ip,
      user_agent: userAgent,
    });
    await refreshDoc.save();

    return {
      accessToken,
      refreshToken,
      user: { id: user._id, username: user.username, roles: user.roles },
    };
  }

  private hashToken(token: string): string {
    return require('crypto').createHash('sha256').update(token).digest('hex');
  }

  private normalizeHash(hash: string): string {
    const h = String(hash ?? '');
    // Legacy Spring Security format: "{bcrypt}$2a$10$..."
    if (h.startsWith('{bcrypt}')) return h.slice('{bcrypt}'.length);
    return h;
  }
}
