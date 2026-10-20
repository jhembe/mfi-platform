import { UserRole } from '../enums';
export interface JwtPayload {
    sub: string;
    email: string;
    tenantId?: string;
    roles?: UserRole[];
    isSuperAdmin?: boolean;
    iat?: number;
    exp?: number;
}
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
}
export interface AuthenticatedUser {
    id: string;
    email: string;
    tenantId?: string;
    roles: UserRole[];
    isSuperAdmin?: boolean;
}
