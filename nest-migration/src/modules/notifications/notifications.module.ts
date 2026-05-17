import { Global, Module } from '@nestjs/common';
import { BookingNotificationsService } from './booking-notifications.service';

@Global()
@Module({
  providers: [BookingNotificationsService],
  exports: [BookingNotificationsService],
})
export class NotificationsModule {}
