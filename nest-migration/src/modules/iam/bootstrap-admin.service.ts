import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { UserAccount } from './user-account.schema';

@Injectable()
export class BootstrapAdminService implements OnModuleInit {
  private readonly logger = new Logger(BootstrapAdminService.name);

  constructor(@InjectModel(UserAccount.name) private readonly users: Model<UserAccount>) {}

  async onModuleInit() {
    const usernameRaw = process.env.APP_BOOTSTRAP_ADMIN_USERNAME;
    const password = process.env.APP_BOOTSTRAP_ADMIN_PASSWORD;
    const orgId = process.env.APP_BOOTSTRAP_ADMIN_ORG_ID;
    const reset = (process.env.APP_BOOTSTRAP_ADMIN_RESET ?? '').toLowerCase() === 'true';

    if (!usernameRaw || !password || !orgId) {
      this.logger.warn('Bootstrap admin disabled: set APP_BOOTSTRAP_ADMIN_USERNAME/PASSWORD/ORG_ID');
      return;
    }

    const username = usernameRaw.toLowerCase().trim();
    if (!username) return;

    const existing = await this.users.findOne({ username }).exec();
    if (existing) {
      if (reset) {
        // Avoid optimistic concurrency/versionKey mismatches with legacy documents.
        const password_hash = await bcrypt.hash(password, 10);
        await this.users.updateOne(
          { username },
          {
            $set: {
              password_hash,
              organization_id: orgId,
              roles: Array.isArray(existing.roles) && existing.roles.length > 0 ? existing.roles : ['ADMIN'],
              mfa_enabled: false,
            },
          },
        ).exec();
        this.logger.warn(`Bootstrap admin password reset: ${username}`);
      } else {
        this.logger.log(`Bootstrap admin exists: ${username}`);
      }
      return;
    }

    const password_hash = await bcrypt.hash(password, 10);
    await this.users.updateOne(
      { username },
      {
        $setOnInsert: {
          username,
          organization_id: orgId,
          roles: ['ADMIN'],
          mfa_enabled: false,
        },
        $set: {
          password_hash,
        },
      },
      { upsert: true },
    ).exec();
    this.logger.log(`Bootstrap admin created: ${username}`);
  }
}

