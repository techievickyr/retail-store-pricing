import { mockUsers, type User } from '../auth';
import { ServiceError } from './http-service';

export function listMockUsers(requester: User): ReturnType<typeof mockUsers> {
  if (requester.role !== 'STORE_ADMIN') throw new ServiceError('You do not have permission for this action', 403, 'FORBIDDEN');
  return mockUsers();
}
