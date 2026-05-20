import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaymentsIntlService } from './payments-intl.service';
import { CreateStripeIntentDto } from './dto/create-stripe-intent.dto';
import { CreatePayPalOrderDto } from './dto/create-paypal-order.dto';

@ApiTags('payments-intl')
@Controller('public/payments/intl')
export class PaymentsIntlController {
  constructor(private readonly payments: PaymentsIntlService) {}

  @Get('methods')
  methods() {
    return this.payments.listMethods();
  }

  @Post('stripe/intent')
  stripeIntent(@Body() dto: CreateStripeIntentDto) {
    return this.payments.createStripePaymentIntent(dto);
  }

  @Post('paypal/order')
  paypalOrder(@Body() dto: CreatePayPalOrderDto) {
    return this.payments.createPayPalOrder(dto);
  }
}
