import { Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { COLOMBIA_PAYMENT_METHOD_CATALOG } from './payments/colombian-payment.constants';
import { ColombianPaymentGatewayService } from './payments/colombian-payment-gateway.service';
import { CreatePublicPaymentIntentDto } from './dto/create-public-payment-intent.dto';
import { PublicSiteService } from './public-site.service';

@ApiTags('public')
@Controller('public')
export class PublicSiteController {
  constructor(
    private readonly service: PublicSiteService,
    private readonly colombianPayments: ColombianPaymentGatewayService,
  ) {}

  @Get('payments/methods')
  listPaymentMethods() {
    return { methods: COLOMBIA_PAYMENT_METHOD_CATALOG };
  }

  @Get('payments/context')
  paymentsContext() {
    const pk = !!(process.env.WOMPI_PUBLIC_KEY ?? '').trim();
    const prv = !!(process.env.WOMPI_PRIVATE_KEY ?? '').trim();
    const ig = !!(process.env.WOMPI_INTEGRITY_SECRET ?? '').trim();
    const ev = !!(process.env.WOMPI_EVENTS_SECRET ?? '').trim();
    return {
      country: 'CO',
      currency: 'COP',
      wompiConfigured: pk && prv && ig,
      wompiWebhookReady: ev,
      wompiPublicKey: pk ? process.env.WOMPI_PUBLIC_KEY : undefined,
      environment: process.env.WOMPI_ENV === 'production' ? 'production' : 'sandbox',
      webhookUrlHint: `${process.env.PUBLIC_API_ORIGIN ?? 'https://TU-API'}/public/payments/webhook`,
      note:
        'Configure esta URL como "URL de eventos" en el dashboard Wompi. Requiere WOMPI_EVENTS_SECRET para validar el checksum. Opcion local: WOMPI_SKIP_WEBHOOK_VERIFY=true solo sin trafico de produccion.',
    };
  }

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get('payments/wompi-presets')
  wompiPresets() {
    return this.colombianPayments.fetchWompiMerchantPresets();
  }

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
  async paymentIntent(@Param('bookingId') bookingId: string, @Body() body: CreatePublicPaymentIntentDto) {
    return this.service.createPaymentIntent({ bookingId, ...body });
  }

  @Post('bookings/:bookingId/payments/complete')
  async completePayment(@Param('bookingId') bookingId: string, @Body() body: any) {
    return this.service.completePayment({ bookingId, ...body });
  }

  @SkipThrottle()
  @Post('payments/webhook')
  async webhook(@Body() body: Record<string, unknown>) {
    return this.service.handlePaymentWebhook(body);
  }
}

