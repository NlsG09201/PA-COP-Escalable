import { Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PublicSiteService } from './public-site.service';

@ApiTags('public')
@Controller('public')
export class PublicSiteController {
  constructor(private readonly service: PublicSiteService) {}

  @Get('catalog')
  async catalog(@Query('siteId') siteId?: string) {
    return this.service.listCatalog({ siteId });
  }

  @Get('bookings/:bookingId')
  async booking(@Param('bookingId') bookingId: string) {
    const booking = await this.service.getBooking({ bookingId });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  @Get('availability')
  async availability(@Query('siteId') siteId: string, @Query('serviceId') serviceId: string, @Query('fromDate') fromDate?: string) {
    return this.service.availability({ siteId, serviceId, fromDate });
  }

  @Post('bookings/quote')
  async quote(@Body() body: any) {
    return this.service.quoteBooking(body);
  }

  @Post('bookings')
  async create(@Body() body: any) {
    const booking = await this.service.createBooking(body);
    return booking;
  }

  @Get('bookings/:bookingId/notifications')
  async notifications(@Param('bookingId') bookingId: string) {
    return this.service.bookingNotifications({ bookingId });
  }

  @Post('bookings/:bookingId/payments/intents')
  async paymentIntent(@Param('bookingId') bookingId: string, @Body() body: any) {
    return this.service.createPaymentIntent({ bookingId, ...body });
  }

  @Post('bookings/:bookingId/payments/complete')
  async completePayment(@Param('bookingId') bookingId: string, @Body() body: any) {
    return this.service.completePayment({ bookingId, ...body });
  }

  @Post('payments/webhook')
  async webhook(@Body() body: any) {
    return this.service.handlePaymentWebhook(body);
  }
}

