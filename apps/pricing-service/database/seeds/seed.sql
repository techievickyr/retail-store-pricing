INSERT INTO pricing_records (id, store_id, sku, product_name, price, currency, effective_from, effective_through, created_by, updated_by)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'STORE001', 'SKU1001', 'Coca Cola 500ml', 45.00, 'INR', CURRENT_DATE - 30, NULL, 'seed', 'seed'),
  ('00000000-0000-4000-8000-000000000002', 'STORE001', 'SKU1002', 'Pepsi 500ml', 42.00, 'INR', CURRENT_DATE - 30, NULL, 'seed', 'seed'),
  ('00000000-0000-4000-8000-000000000003', 'STORE100', 'SKU1001', 'Coca Cola 500ml', 1.25, 'GBP', CURRENT_DATE - 20, NULL, 'seed', 'seed'),
  ('00000000-0000-4000-8000-000000000004', 'STORE200', 'SKU2001', 'Whole Milk 1L', 3.99, 'USD', CURRENT_DATE - 20, NULL, 'seed', 'seed')
ON CONFLICT (store_id, sku, effective_from) DO NOTHING;
