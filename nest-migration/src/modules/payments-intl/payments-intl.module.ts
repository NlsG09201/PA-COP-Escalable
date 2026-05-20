import { Module } from '@nestjs/common';
import { PaymentsIntlController } from './payments-intl.controller';
import { PaymentsIntlService } from './payments-intl.service';

@Module({
  controllers: [PaymentsIntlController],
  providers: [PaymentsIntlService],
  exports: [PaymentsIntlService],
})
export class PaymentsIntlModule {}
