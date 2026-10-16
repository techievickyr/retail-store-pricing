import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { uploadCsv } from '../../../lib/api';
import { pricingApi } from '../pricing-api';
import UploadPage from '../../../app/pricing/upload/page';

const mockUsePathname = jest.fn().mockReturnValue('/pricing/upload');

jest.mock('next/navigation', () => ({ usePathname: () => mockUsePathname() }));
jest.mock('../../../lib/api', () => ({
  ApiError: class ApiError extends Error {},
  uploadCsv: jest.fn(),
}));
jest.mock('../pricing-api', () => ({
  pricingApi: {
    getStores: jest.fn(),
    getUploadLimits: jest.fn(),
  },
}));

describe('upload page route lifecycle', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/pricing/upload');
    jest.mocked(pricingApi.getStores).mockResolvedValue([
      { storeId: 'STORE001', name: 'Mumbai Central', country: 'India', currency: 'INR' },
    ]);
    jest.mocked(pricingApi.getUploadLimits).mockResolvedValue({ maxUploadBytes: 5 * 1024 * 1024 });
    jest.mocked(uploadCsv).mockResolvedValue({ id: 'job-001', status: 'queued' });
  });

  afterEach(() => jest.clearAllMocks());

  it('shows a fresh form after leaving and returning from a successful upload', async () => {
    const { rerender } = render(<UploadPage />);
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Store' })).toHaveValue('STORE001'));

    const fileInput = document.querySelector('input[type="file"]');
    if (!(fileInput instanceof HTMLInputElement)) throw new Error('CSV file input was not rendered');
    const file = new File(['csv'], 'prices.csv', { type: 'text/csv' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.submit(fileInput.closest('form')!);

    expect(await screen.findByText('Your import is queued')).toBeInTheDocument();

    mockUsePathname.mockReturnValue('/pricing/imports');
    rerender(<UploadPage />);
    mockUsePathname.mockReturnValue('/pricing/upload');
    rerender(<UploadPage />);

    expect(await screen.findByRole('button', { name: /Upload and validate/ })).toBeInTheDocument();
    expect(screen.queryByText('Your import is queued')).not.toBeInTheDocument();
  });
});
