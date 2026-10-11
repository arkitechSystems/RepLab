import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { server, http, HttpResponse } from '../test/server';
import QueryProvider from './QueryProvider';
import { keys, fetchPath } from './keys';

function Programs() {
  const { data } = useQuery({ queryKey: keys.programs(), queryFn: fetchPath('/programs') });
  return <div>{data ? data.map((p) => p.name).join(', ') : 'loading'}</div>;
}

describe('QueryProvider', () => {
  it('renders the app and serves queries', async () => {
    server.use(http.get('*/programs', () => HttpResponse.json([{ id: 1, name: 'Push' }, { id: 2, name: 'Legs' }])));
    render(<QueryProvider><Programs /></QueryProvider>);
    await waitFor(() => expect(screen.getByText('Push, Legs')).toBeInTheDocument());
  });
});
