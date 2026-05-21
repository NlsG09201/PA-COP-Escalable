import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, ConnectionStates, Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { UserAccount } from './user-account.schema';
import { SUPER_ADMIN_ROLE } from './roles.constants';

const ELEVATED_ROLES = new Set([SUPER_ADMIN_ROLE, 'ADMIN', 'ORG_ADMIN', 'SITE_ADMIN']);
const MONGO_WAIT_MS = 45_000;

@Injectable()
export class BootstrapAdminService implements OnModuleInit {
  private readonly logger = new Logger(BootstrapAdminService.name);

  constructor(
    @InjectConnection() private readonly mongo: Connection,
    @InjectModel(UserAccount.name) private readonly users: Model<UserAccount>,
  ) {}

  async onModuleInit() {
    try {
      await this.waitForMongo();
      await this.runBootstrap();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/buffering timed out|ServerSelection|whitelist|ECONNREFUSED/i.test(msg)) {
        this.logger.error(
          `Bootstrap admin omitido (Mongo no conectado): ${msg}. Atlas -> Network Access -> 0.0.0.0/0 Active. Ver deploy/ATLAS-RENDER.md`,
        );
      } else {
        this.logger.error(`Bootstrap admin omitido: ${msg}`);
      }
    }
  }

  /** Espera conexión Atlas antes de consultar users (evita buffering timeout de 10s). */
  private async waitForMongo(): Promise<void> {
    if (this.mongo.readyState === ConnectionStates.connected) return;

    await Promise.race([
      this.mongo.asPromise(),
      new Promise<void>((_, reject) => {
        setTimeout(
          () =>
            reject(
              new Error(
                `Mongo no conectó en ${MONGO_WAIT_MS / 1000}s. Atlas → Network Access → 0.0.0.0/0 Active`,
              ),
            ),
          MONGO_WAIT_MS,
        );
      }),
    ]);
  }

  /** Fuerza creación/reset del admin (p. ej. endpoint setup-bootstrap en Render). */
  async forceBootstrapAdmin(): Promise<{ username: string; action: 'created' | 'reset' | 'skipped' }> {
    await this.waitForMongo();
    const prev = process.env.APP_BOOTSTRAP_ADMIN_RESET;
    process.env.APP_BOOTSTRAP_ADMIN_RESET = 'true';
    try {
      return await this.runBootstrap();
    } finally {
      if (prev === undefined) delete process.env.APP_BOOTSTRAP_ADMIN_RESET;
      else process.env.APP_BOOTSTRAP_ADMIN_RESET = prev;
    }
  }

  private async runBootstrap(): Promise<{ username: string; action: 'created' | 'reset' | 'skipped' }> {
    const usernameRaw = process.env.APP_BOOTSTRAP_ADMIN_USERNAME;
    const password = process.env.APP_BOOTSTRAP_ADMIN_PASSWORD;
    const orgId = process.env.APP_BOOTSTRAP_ADMIN_ORG_ID;
    const email = String(process.env.APP_BOOTSTRAP_ADMIN_EMAIL ?? '').trim().toLowerCase();
    const reset = (process.env.APP_BOOTSTRAP_ADMIN_RESET ?? '').toLowerCase() === 'true';
    const enforceSoleAdmin = (process.env.APP_BOOTSTRAP_ENFORCE_SOLE_ADMIN ?? 'true').toLowerCase() !== 'false';

    if (!usernameRaw || !password || !orgId) {
      this.logger.warn('Bootstrap admin disabled: set APP_BOOTSTRAP_ADMIN_USERNAME/PASSWORD/ORG_ID');
      return { username: '', action: 'skipped' };
    }

    const username = usernameRaw.toLowerCase().trim();
    if (!username) return { username: '', action: 'skipped' };

    const bootstrapRoles = [SUPER_ADMIN_ROLE, 'ADMIN'];

    const existing = await this.users.findOne({ username }).exec();
    if (existing) {
      if (reset) {
        const password_hash = await bcrypt.hash(password, 10);
        await this.users.updateOne(
          { username },
          {
            $set: {
              password_hash,
              organization_id: orgId,
              roles: bootstrapRoles,
              mfa_enabled: false,
              ...(email ? { email } : {}),
            },
          },
        ).exec();
        this.logger.warn(`Bootstrap admin password reset (${SUPER_ADMIN_ROLE}): ${username}`);
        if (enforceSoleAdmin) await this.demoteOtherElevatedUsers(username);
        return { username, action: 'reset' };
      } else {
        const merged = new Set<string>([...(Array.isArray(existing.roles) ? existing.roles : []), ...bootstrapRoles]);
        await this.users.updateOne(
          { username },
          {
            $set: {
              roles: Array.from(merged),
              organization_id: orgId,
              ...(email ? { email } : {}),
            },
          },
        ).exec();
        this.logger.log(`Bootstrap admin exists (roles ensured): ${username}`);
        if (enforceSoleAdmin) await this.demoteOtherElevatedUsers(username);
        return { username, action: 'skipped' };
      }
    } else {
      const password_hash = await bcrypt.hash(password, 10);
      await this.users.updateOne(
        { username },
        {
          $setOnInsert: {
            username,
            organization_id: orgId,
            roles: bootstrapRoles,
            mfa_enabled: false,
            ...(email ? { email } : {}),
          },
          $set: {
            password_hash,
          },
        },
        { upsert: true },
      ).exec();
      this.logger.log(`Bootstrap admin created (${SUPER_ADMIN_ROLE}): ${username}`);
      if (enforceSoleAdmin) await this.demoteOtherElevatedUsers(username);
      return { username, action: 'created' };
    }
  }

  /** Deja SUPER_ADMIN/ADMIN solo en el usuario bootstrap configurado. */
  private async demoteOtherElevatedUsers(bootstrapUsername: string) {
    const others = await this.users.find({ username: { $ne: bootstrapUsername } }).exec();
    let demoted = 0;
    for (const user of others) {
      const before = Array.isArray(user.roles) ? user.roles : [];
      const after = before.filter((r) => !ELEVATED_ROLES.has(String(r)));
      if (after.length === before.length) continue;
      const roles = after.length > 0 ? after : ['PACIENTE'];
      await this.users.updateOne({ _id: user._id }, { $set: { roles } }).exec();
      demoted += 1;
    }
    if (demoted > 0) {
      this.logger.warn(`Removed elevated roles from ${demoted} user(s); only ${bootstrapUsername} is admin.`);
    }
  }
}
