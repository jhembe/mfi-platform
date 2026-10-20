import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class StorageService {
  private readonly client: Minio.Client;
  private readonly bucket: string;
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly config: ConfigService) {
    this.client = new Minio.Client({
      endPoint: config.getOrThrow<string>('MINIO_ENDPOINT'),
      port: parseInt(config.getOrThrow<string>('MINIO_PORT'), 10),
      useSSL: config.get<string>('MINIO_USE_SSL') === 'true',
      accessKey: config.getOrThrow<string>('MINIO_ACCESS_KEY'),
      secretKey: config.getOrThrow<string>('MINIO_SECRET_KEY'),
    });
    this.bucket = config.getOrThrow<string>('MINIO_BUCKET');
  }

  async ensureBucket(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket, 'us-east-1');
    }
  }

  async uploadBuffer(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    try {
      await this.ensureBucket();
      await this.client.putObject(this.bucket, key, buffer, buffer.length, {
        'Content-Type': contentType,
      });
      return key;
    } catch (err) {
      this.logger.error('MinIO upload failed', err);
      throw new InternalServerErrorException('File upload failed');
    }
  }

  async getSignedUrl(key: string, expirySeconds = 86400): Promise<string> {
    return this.client.presignedGetObject(this.bucket, key, expirySeconds);
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }
}
