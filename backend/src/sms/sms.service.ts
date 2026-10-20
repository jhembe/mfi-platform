import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly apiKey: string;
  private readonly username: string;
  private readonly senderId: string;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = configService.get<string>('AFRICAS_TALKING_API_KEY', '');
    this.username = configService.get<string>('AFRICAS_TALKING_USERNAME', '');
    this.senderId = configService.get<string>('AFRICAS_TALKING_SENDER_ID', '');
    this.enabled = !!(this.apiKey && this.username);
  }

  async send(to: string, message: string): Promise<void> {
    if (!this.enabled) {
      this.logger.warn(`SMS disabled (no API key). Would have sent to ${to}: ${message}`);
      return;
    }

    const phone = this.normalisePhone(to);
    const body = new URLSearchParams({
      username: this.username,
      to: phone,
      message,
      ...(this.senderId ? { from: this.senderId } : {}),
    });

    try {
      const res = await fetch('https://api.africastalking.com/version1/messaging', {
        method: 'POST',
        headers: {
          apiKey: this.apiKey,
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Africa's Talking API error ${res.status}: ${text}`);
      }

      this.logger.log(`SMS sent to ${phone}`);
    } catch (err) {
      this.logger.error(`Failed to send SMS to ${phone}`, err);
      throw err;
    }
  }

  // Tanzania numbers: accept 07xx or +255xxx formats, normalise to +255xxx
  private normalisePhone(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (digits.startsWith('255') && digits.length === 12) return `+${digits}`;
    if (digits.startsWith('0') && digits.length === 10) return `+255${digits.slice(1)}`;
    if (digits.length === 9) return `+255${digits}`;
    return `+${digits}`;
  }
}
