export interface Store {
  storeId: string;
  name: string;
  country: string;
  currency: string;
  timezone: string;
}

export interface Product { sku: string; name: string }

export interface StoreService {
  getStore(storeId: string): Promise<Store | undefined>;
  getStores(): Promise<Store[]>;
}

export interface ProductService {
  getProduct(sku: string): Promise<Product | undefined>;
  searchProducts(query: string): Promise<Product[]>;
}

const stores: Store[] = [
  { storeId: 'STORE001', name: 'Mumbai Central', country: 'India', currency: 'INR', timezone: 'Asia/Kolkata' },
  { storeId: 'STORE002', name: 'Delhi Market', country: 'India', currency: 'INR', timezone: 'Asia/Kolkata' },
  { storeId: 'STORE100', name: 'London Bridge', country: 'United Kingdom', currency: 'GBP', timezone: 'Europe/London' },
  { storeId: 'STORE200', name: 'Brooklyn North', country: 'United States', currency: 'USD', timezone: 'America/New_York' },
];

const products: Product[] = [
  { sku: 'SKU1001', name: 'Coca Cola 500ml' },
  { sku: 'SKU1002', name: 'Pepsi 500ml' },
  { sku: 'SKU1003', name: 'Sparkling Water 1L' },
  { sku: 'SKU2001', name: 'Whole Milk 1L' },
  { sku: 'SKU2002', name: 'Ground Coffee 250g' },
];

export const mockStoreService: StoreService = {
  async getStore(storeId) { return stores.find((store) => store.storeId === storeId); },
  async getStores() { return stores; },
};

export const mockProductService: ProductService = {
  async getProduct(sku) { return products.find((product) => product.sku === sku); },
  async searchProducts(query) { return products.filter((product) => `${product.sku} ${product.name}`.toLowerCase().includes(query.toLowerCase())); },
};
