import { canAccessStore, type User } from '../auth';
import { mockProductService, mockStoreService, type Product, type Store } from '../catalog';
import { getCached } from './cache-service';

export async function getAccessibleStores(user: User): Promise<Store[]> {
  const stores = await getCached('stores:all', () => mockStoreService.getStores());
  return stores.filter((store) => canAccessStore(user, store.storeId));
}

export function getStore(storeId: string): Promise<Store | undefined> {
  return mockStoreService.getStore(storeId);
}

export async function searchProducts(query: string): Promise<Product[]> {
  const normalizedQuery = query.slice(0, 100);
  return getCached(`products:${normalizedQuery.toLowerCase()}`, () => mockProductService.searchProducts(normalizedQuery), 60);
}
