import { render, screen } from '@testing-library/react';
import AppShell from './app-shell';

jest.mock('next/navigation', () => ({ usePathname: () => '/pricing' }));

describe('pricing application shell', () => {
  beforeEach(() => window.localStorage.clear());

  it('shows the pricing navigation and current store scope', () => {
    render(<AppShell><h1>Price book content</h1></AppShell>);

    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Price book' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Mumbai Central')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Price book content' })).toBeInTheDocument();
  });

  it('renders the mock identity selector for development role testing', () => {
    render(<AppShell><main>Workspace</main></AppShell>);

    expect(screen.getByLabelText('Switch mock user')).toHaveValue('manager-store001');
    expect(screen.getByRole('option', { name: 'Retail Admin · Store admin' })).toBeInTheDocument();
  });
});
