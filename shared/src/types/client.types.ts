import { KycDocumentType } from '../enums';

export interface ClientProfile {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  phone: string;
  email?: string;
  address: string;
  ward: string;
  district: string;
  region: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface KycDocument {
  id: string;
  clientId: string;
  documentType: KycDocumentType;
  documentNumber: string;
  fileUrl: string;
  verifiedAt?: Date;
  verifiedBy?: string;
}
