import AxiosMockAdapter from 'axios-mock-adapter';
import { api, pricingHttpClient, uploadCsv } from './api';

const mock = new AxiosMockAdapter(pricingHttpClient);

describe('pricing Axios client', () => {
  beforeEach(() => {
    window.localStorage.setItem('pricing-mock-user', 'manager-store100');
    mock.reset();
  });

  afterAll(() => mock.restore());

  it('adds the selected mock identity through the request interceptor', async () => {
    mock.onGet('/api/me').reply((config) => {
      expect(config.headers?.['x-mock-user']).toBe('manager-store100');
      return [200, { userId: 'user-100' }];
    });

    await expect(api<{ userId: string }>('/api/me')).resolves.toEqual({ userId: 'user-100' });
  });

  it('passes an AbortSignal to the CSV upload request', async () => {
    const controller = new AbortController();
    const file = new File(['Store ID,SKU,Product Name,Price,Date'], 'feed.csv', { type: 'text/csv' });
    mock.onPost('/api/pricing-imports').reply((config) => {
      expect(config.signal).toBe(controller.signal);
      expect(config.headers?.['x-mock-user']).toBe('manager-store100');
      return [202, { id: 'job-123', status: 'queued' }];
    });

    await expect(uploadCsv('STORE100', file, jest.fn(), controller.signal)).resolves.toEqual({ id: 'job-123', status: 'queued' });
  });
});
