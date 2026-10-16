import type { NextFunction, Request, Response } from 'express';

export type Role = 'STORE_MANAGER' | 'STORE_ADMIN' | 'PRICING_VIEWER';
export interface User {
  userId: string;
  username: string;
  role: Role;
  storeIds: string[] | '*';
  timezone: string;
  currency: string;
}

declare global {
  namespace Express {
    interface Request { user?: User; correlationId?: string }
  }
}

const users: Record<string, User> = {
  'manager-store001': { userId: 'user-001', username: 'Asha Patel', role: 'STORE_MANAGER', storeIds: ['STORE001'], timezone: 'Asia/Kolkata', currency: 'INR' },
  'manager-store100': { userId: 'user-100', username: 'Oliver Reed', role: 'STORE_MANAGER', storeIds: ['STORE100'], timezone: 'Europe/London', currency: 'GBP' },
  'store-admin': { userId: 'admin-001', username: 'Retail Admin', role: 'STORE_ADMIN', storeIds: '*', timezone: 'UTC', currency: 'USD' },
  'pricing-viewer': { userId: 'viewer-001', username: 'Pricing Viewer', role: 'PRICING_VIEWER', storeIds: '*', timezone: 'UTC', currency: 'USD' },
};

export interface AuthProvider {
  getUser(identity: string | undefined): Promise<User | undefined>;
}

export const mockAuthProvider: AuthProvider = {
  async getUser(identity) { return users[identity ?? 'manager-store001']; },
};

export function createAuthMiddleware(provider: AuthProvider) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = await provider.getUser(req.header('x-mock-user'));
    if (!user) {
      res.status(401).json({ code: 'UNAUTHENTICATED', message: 'Unknown mock user', details: {}, correlationId: req.correlationId });
      return;
    }
    req.user = user;
    next();
  };
}

export const mockAuth = createAuthMiddleware(mockAuthProvider);

export function requireRoles(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'You do not have permission for this action', details: {}, correlationId: req.correlationId });
      return;
    }
    next();
  };
}

export function canAccessStore(user: User, storeId: string): boolean {
  return user.storeIds === '*' || user.storeIds.includes(storeId);
}

export function mockUsers(): Pick<User, 'userId' | 'username' | 'role' | 'storeIds'>[] {
  return Object.values(users).map(({ userId, username, role, storeIds }) => ({ userId, username, role, storeIds }));
}
