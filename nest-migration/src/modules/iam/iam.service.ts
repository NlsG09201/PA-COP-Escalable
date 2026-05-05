import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { UserAccount } from './user-account.schema';
import { RefreshToken } from './schemas/refresh-token.schema';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class IamService {
  constructor(
    @InjectModel(UserAccount.name) private userModel: Model<UserAccount>,
    @InjectModel(RefreshToken.name) private refreshModel: Model<RefreshToken>,
    private jwtService: JwtService,
  ) {}

  async login(dto: LoginDto, ip?: string, userAgent?: string) {
    const user = await this.userModel.findOne({ username: dto.username.toLowerCase() }).exec();
    const storedHash = user?.password_hash ? this.normalizeHash(user.password_hash) : '';
    if (!user || !storedHash || !(await bcrypt.compare(dto.password, storedHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokenPair(user, dto.siteId, ip, userAgent);
  }

  async refreshToken(token: string, ip?: string, userAgent?: string) {
    const hash = this.hashToken(token);
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
    const payload = {
      sub: user.username,
      user_id: user._id,
      organization_id: user.organization_id,
      site_id: siteId,
      roles: user.roles,
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
