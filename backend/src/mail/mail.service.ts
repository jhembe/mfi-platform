import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    this.from = configService.getOrThrow<string>('SMTP_FROM');

    this.transporter = nodemailer.createTransport({
      host: configService.getOrThrow<string>('SMTP_HOST'),
      port: configService.get<number>('SMTP_PORT', 587),
      secure: configService.get<boolean>('SMTP_SECURE', false),
      auth: {
        user: configService.getOrThrow<string>('SMTP_USER'),
        pass: configService.getOrThrow<string>('SMTP_PASSWORD'),
      },
      tls: { rejectUnauthorized: false },
    });
  }

  async sendPasswordReset(to: string, resetUrl: string): Promise<void> {
    await this.send({
      to,
      subject: 'Reset your MFI Platform password',
      html: `
        <p>You requested a password reset for your MFI Platform account.</p>
        <p>Click the link below to reset your password. This link expires in <strong>1 hour</strong>.</p>
        <p><a href="${resetUrl}" style="background:#1E3A5F;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;">Reset Password</a></p>
        <p>If you did not request this, ignore this email — your password will not change.</p>
      `,
    });
  }

  async sendWelcome(to: string, firstName: string, tenantName: string): Promise<void> {
    await this.send({
      to,
      subject: `Welcome to ${tenantName} — MFI Platform`,
      html: `
        <p>Hi ${firstName},</p>
        <p>Your account on <strong>${tenantName}</strong> (MFI Platform) has been created.</p>
        <p>Log in at your tenant URL to get started. Contact your administrator if you need your password reset.</p>
      `,
    });
  }

  private async send(options: { to: string; subject: string; html: string }): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.from, ...options });
    } catch (err) {
      this.logger.error(`Failed to send email to ${options.to}`, err);
      throw err;
    }
  }
}
