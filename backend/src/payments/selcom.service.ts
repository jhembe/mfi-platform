import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface SelcomOrderPayload {
  vendor: string;
  order_id: string;
  buyer_phone: string;
  amount: number;
  currency: string;
  items: number;
  payment_methods: string;
  redirect_url: string;
  cancel_url: string;
  webhook: string;
  billing: {
    firstname: string;
    lastname: string;
    email_address: string;
    msisdn: string;
    country_code: string;
    state: string;
    city: string;
    postcode: string;
    street_address: string;
  };
}

export interface SelcomOrderResponse {
  reference: string;
  resultcode: string;
  result: string;
  message: string;
  data?: { payment_token?: string; payment_url?: string };
}

export interface SelcomCallbackPayload {
  transid: string;
  reference: string;
  order_id: string;
  msisdn: string;
  amount: string;
  currency: string;
  result: string;
  resultcode: string;
  channel?: string;
  message?: string;
}

@Injectable()
export class SelcomService {
  private readonly logger = new Logger(SelcomService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly vendorId: string;
  private readonly callbackUrl: string;
  private readonly frontendUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config.get<string>('SELCOM_BASE_URL', 'https://apigw.selcomchannels.com');
    this.apiKey = config.get<string>('SELCOM_API_KEY', '');
    this.apiSecret = config.get<string>('SELCOM_API_SECRET', '');
    this.vendorId = config.get<string>('SELCOM_VENDOR_ID', '');
    this.callbackUrl = config.get<string>('SELCOM_CALLBACK_URL', 'https://mfi.mahembega.com/api/payments/callback');
    this.frontendUrl = config.get<string>('FRONTEND_URL', 'https://mfi.mahembega.com');
  }

  // ── Request signing ─────────────────────────────────────────────────────────

  private sign(body: string): string {
    return crypto.createHmac('sha256', this.apiSecret).update(body).digest('base64');
  }

  private buildHeaders(body: string): Record<string, string> {
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, '+0000');
    return {
      'Content-Type': 'application/json;charset=UTF-8',
      'Authorization': `SELCOM ${Buffer.from(this.apiKey).toString('base64')}`,
      'Digest': `SHA-256=${this.sign(body)}`,
      'Timestamp': timestamp,
    };
  }

  // ── Create order (USSD push) ─────────────────────────────────────────────────

  async createOrder(params: {
    orderId: string;
    phone: string;
    amount: number;
    customerName: string;
  }): Promise<SelcomOrderResponse> {
    const payload: SelcomOrderPayload = {
      vendor: this.vendorId,
      order_id: params.orderId,
      buyer_phone: params.phone,
      amount: params.amount,
      currency: 'TZS',
      items: 1,
      payment_methods: 'ALL',
      redirect_url: `${this.frontendUrl}/dashboard`,
      cancel_url: `${this.frontendUrl}/dashboard`,
      webhook: this.callbackUrl,
      billing: {
        firstname: params.customerName.split(' ')[0] || 'Client',
        lastname: params.customerName.split(' ').slice(1).join(' ') || 'N/A',
        email_address: 'noreply@mfi.local',
        msisdn: params.phone,
        country_code: 'TZ',
        state: 'Dar es Salaam',
        city: 'Dar es Salaam',
        postcode: '00000',
        street_address: 'N/A',
      },
    };

    const body = JSON.stringify(payload);
    const headers = this.buildHeaders(body);

    this.logger.log(`Selcom createOrder: orderId=${params.orderId} phone=${params.phone} amount=${params.amount}`);

    const response = await fetch(`${this.baseUrl}/v3/checkout/create-order`, {
      method: 'POST',
      headers,
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Selcom createOrder HTTP ${response.status}: ${text}`);
      throw new Error(`Selcom API error: ${response.status}`);
    }

    const result = await response.json() as SelcomOrderResponse;
    this.logger.log(`Selcom createOrder response: ${JSON.stringify(result)}`);
    return result;
  }

  // ── Order status check ───────────────────────────────────────────────────────

  async checkOrderStatus(reference: string): Promise<SelcomOrderResponse> {
    const headers = this.buildHeaders('');
    const response = await fetch(`${this.baseUrl}/v3/checkout/order-status/${reference}`, {
      method: 'GET',
      headers,
    });
    if (!response.ok) throw new Error(`Selcom status check HTTP ${response.status}`);
    return response.json() as Promise<SelcomOrderResponse>;
  }

  // ── Callback verification ────────────────────────────────────────────────────

  verifyCallback(body: string, digestHeader: string | undefined): boolean {
    if (!digestHeader) return false;
    const expected = `SHA-256=${this.sign(body)}`;
    try {
      return crypto.timingSafeEqual(Buffer.from(digestHeader), Buffer.from(expected));
    } catch {
      return false;
    }
  }
}
