import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, ConnectionStates, Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { UserAccount } from './user-account.schema';
import { SUPER_ADMIN_ROLE } from './roles.constants';
import { extractPasswordHash } from './password-hash.util';

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

  /**
   * Permite POST /api/auth/ensure-bootstrap sin secreto cuando:
   * - no hay usuarios con SUPER_ADMIN/ADMIN, o
   * - el usuario bootstrap existe pero su contraseña no coincide con APP_BOOTSTRAP_ADMIN_PASSWORD.
   */
  async canAutoEnsureBootstrap(): Promise<boolean> {
    const usernameRaw = process.env.APP_BOOTSTRAP_ADMIN_USERNAME;
    const password = process.env.APP_BOOTSTRAP_ADMIN_PASSWORD;
    const orgId = process.env.APP_BOOTSTRAP_ADMIN_ORG_ID;
    if (!usernameRaw || !password || !orgId) return false;

    await this.waitForMongo();
    const username = usernameRaw.toLowerCase().trim();
    const elevated = await this.users
      .countDocuments({ roles: { $in: [SUPER_ADMIN_ROLE, 'ADMIN'] } })
      .exec();
    if (elevated === 0) return true;

    const dupCount = await this.countBootstrapUsernameMatches(username);
    if (dupCount > 1) return true;

    const user = await this.findBootstrapUser(username);
    if (!user) return true;

    const normalized = extractPasswordHash(user.password_hash);
    if (!normalized) return true;

    const passwordOk = await bcrypt.compare(password, normalized);
    return !passwordOk;
  }

  async getBootstrapStatus(): Promise<{
    envConfigured: boolean;
    elevatedCount: number;
    bootstrapUserExists: boolean;
    bootstrapPasswordMatchesEnv: boolean;
    bootstrapDuplicateCount: number;
    canAutoRepair: boolean;
  }> {
    const usernameRaw = process.env.APP_BOOTSTRAP_ADMIN_USERNAME;
    const password = process.env.APP_BOOTSTRAP_ADMIN_PASSWORD;
    const orgId = process.env.APP_BOOTSTRAP_ADMIN_ORG_ID;
    const envConfigured = !!(usernameRaw && password && orgId);
    if (!envConfigured) {
      return {
        envConfigured: false,
        elevatedCount: 0,
        bootstrapUserExists: false,
        bootstrapPasswordMatchesEnv: false,
        bootstrapDuplicateCount: 0,
        canAutoRepair: false,
      };
    }

    await this.waitForMongo();
    const username = usernameRaw.toLowerCase().trim();
    const elevated = await this.users
      .countDocuments({ roles: { $in: [SUPER_ADMIN_ROLE, 'ADMIN'] } })
      .exec();
    const bootstrapDuplicateCount = await this.countBootstrapUsernameMatches(username);
    const user = await this.findBootstrapUser(username);
    let bootstrapPasswordMatchesEnv = false;
    if (user?.password_hash) {
      const normalized = extractPasswordHash(user.password_hash);
      bootstrapPasswordMatchesEnv = !!(normalized && (await bcrypt.compare(password, normalized)));
    }
    return {
      envConfigured: true,
      elevatedCount: elevated,
      bootstrapUserExists: !!user,
      bootstrapPasswordMatchesEnv,
      bootstrapDuplicateCount,
      canAutoRepair: await this.canAutoEnsureBootstrap(),
    };
  }

  /** Comprueba que el admin bootstrap puede autenticarse con APP_BOOTSTRAP_ADMIN_PASSWORD. */
  async verifyBootstrapLogin(overridePassword?: string): Promise<boolean> {
    const username = (process.env.APP_BOOTSTRAP_ADMIN_USERNAME ?? '').toLowerCase().trim();
    const password = (overridePassword ?? process.env.APP_BOOTSTRAP_ADMIN_PASSWORD ?? '').trim();
    if (!username || !password) return false;

    const matches = await this.findAllBootstrapUsers(username);
    for (const user of matches) {
      const stored = extractPasswordHash(user.password_hash);
      if (stored && (await bcrypt.compare(password, stored))) return true;
    }
    return false;
  }

  private usernameRegex(username: string): RegExp {
    return new RegExp(`^${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  }

  private async countBootstrapUsernameMatches(username: string): Promise<number> {
    const col = this.mongo.db.collection('users');
    return col.countDocuments({ username: this.usernameRegex(username) });
  }

  private async findAllBootstrapUsers(username: string): Promise<{ password_hash?: unknown }[]> {
    const col = this.mongo.db.collection<{ password_hash?: unknown }>('users');
    return col.find({ username: this.usernameRegex(username) }).toArray();
  }

  /** Mongoose + colección nativa (sedes seed con _id UUID binario). */
  private async findBootstrapUser(username: string): Promise<{ password_hash?: unknown } | null> {
    const all = await this.findAllBootstrapUsers(username);
    if (all.length) return all[0];
    return (await this.users.findOne({ username }).lean().exec()) ?? null;
  }

  /** Fuerza creación/reset del admin (p. ej. endpoint setup-bootstrap en Render). */
  async forceBootstrapAdmin(overridePassword?: string): Promise<{
    username: string;
    action: 'created' | 'reset' | 'skipped';
    verified: boolean;
  }> {
    await this.waitForMongo();
    const prevReset = process.env.APP_BOOTSTRAP_ADMIN_RESET;
    const prevPass = process.env.APP_BOOTSTRAP_ADMIN_PASSWORD;
    process.env.APP_BOOTSTRAP_ADMIN_RESET = 'true';
    if (overridePassword?.trim()) {
      process.env.APP_BOOTSTRAP_ADMIN_PASSWORD = overridePassword.trim();
    }
    try {
      const result = await this.runBootstrap();
      const verified = await this.verifyBootstrapLogin(overridePassword);
      if (!verified) {
        this.logger.error(
          `Bootstrap admin ${result.username} guardado pero verifyBootstrapLogin falló. Revisa APP_BOOTSTRAP_ADMIN_PASSWORD en Render.`,
        );
      }
      return { ...result, verified };
    } finally {
      if (prevReset === undefined) delete process.env.APP_BOOTSTRAP_ADMIN_RESET;
      else process.env.APP_BOOTSTRAP_ADMIN_RESET = prevReset;
      if (prevPass === undefined) delete process.env.APP_BOOTSTRAP_ADMIN_PASSWORD;
      else process.env.APP_BOOTSTRAP_ADMIN_PASSWORD = prevPass;
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
    const action = await this.upsertBootstrapUserNative({
      username,
      password,
      orgId,
      email,
      roles: bootstrapRoles,
      reset,
    });

    if (enforceSoleAdmin) await this.demoteOtherElevatedUsers(username);
    if (action === 'reset') {
      this.logger.warn(`Bootstrap admin password reset (${SUPER_ADMIN_ROLE}): ${username}`);
    } else if (action === 'created') {
      this.logger.log(`Bootstrap admin created (${SUPER_ADMIN_ROLE}): ${username}`);
    } else {
      this.logger.log(`Bootstrap admin exists (roles ensured): ${username}`);
    }
    return { username, action };
  }

  /** Escritura en colección nativa (compatible con login y seeds Atlas con _id string). */
  private async upsertBootstrapUserNative(opts: {
    username: string;
    password: string;
    orgId: string;
    email: string;
    roles: string[];
    reset: boolean;
  }): Promise<'created' | 'reset' | 'skipped'> {
    const col = this.mongo.db.collection('users');
    const usernameRegex = this.usernameRegex(opts.username);
    const existing = await col.findOne({ username: usernameRegex });
    const password_hash = await bcrypt.hash(opts.password, 10);
    const dupCount = await col.countDocuments({ username: usernameRegex });
    const forceReset = opts.reset || dupCount > 1;

    if (existing && !forceReset) {
      const merged = new Set<string>([
        ...(Array.isArray(existing.roles) ? existing.roles.map(String) : []),
        ...opts.roles,
      ]);
      const keepId = existing._id;
      await col.deleteMany({ username: usernameRegex });
      await this.users.deleteMany({ username: usernameRegex }).exec();
      await col.insertOne({
        _id: keepId,
        username: opts.username,
        organization_id: opts.orgId,
        password_hash,
        roles: Array.from(merged),
        mfa_enabled: false,
        ...(opts.email ? { email: opts.email } : {}),
        createdAt: (existing as { createdAt?: Date }).createdAt ?? new Date(),
        updatedAt: new Date(),
      } as Record<string, unknown>);
      return 'skipped';
    }

    await col.deleteMany({ username: usernameRegex });
    await this.users.deleteMany({ username: usernameRegex }).exec();

    await col.insertOne({
      _id: uuidv4(),
      username: opts.username,
      organization_id: opts.orgId,
      password_hash,
      roles: opts.roles,
      mfa_enabled: false,
      ...(opts.email ? { email: opts.email } : {}),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Record<string, unknown>);
    return existing ? 'reset' : 'created';
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
