import type { Folder, NodeGroup } from '@client/types.gen.ts';

import { createMockFolder, createMockNodeGroup } from '../test-utils';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const mockFolders: Folder[] = [createMockFolder()];
const mockNodeGroup: NodeGroup = createMockNodeGroup();

// jsdom doesn't have matchMedia — Carbon's Tabs component needs it
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

// Mock the query options to use test data
vi.mock('@client/@tanstack/react-query.gen.ts', () => ({
  listFoldersOptions: () => ({
    queryKey: ['listFolders'],
    queryFn: () => mockFolders,
  }),
  byIdOptions: () => ({
    queryKey: ['byId'],
    queryFn: () => mockNodeGroup,
  }),
  getUploadsOptions: () => ({
    queryKey: ['uploads'],
    queryFn: () => [
      { id: 1, createdAt: '2026-05-15T14:30:00', valueCount: 24 },
      { id: 2, createdAt: '2026-05-15T14:25:00', valueCount: 24 },
    ],
  }),
}));

const { FolderPage } = await import('@app/pages/FolderPage');

function renderFolderPage(folderId: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
    },
  });
  queryClient.setQueryData(['listFolders'], mockFolders);
  queryClient.setQueryData(['byId'], mockNodeGroup);
  queryClient.setQueryData(['uploads'], [
    { id: 1, createdAt: '2026-05-15T14:30:00', valueCount: 24 },
    { id: 2, createdAt: '2026-05-15T14:25:00', valueCount: 24 },
  ]);

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/folder/${folderId}`]}>
        <Routes>
          <Route path="/folder/:folderId" element={<FolderPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('<FolderPage />', () => {
  it('renders all three tabs', async () => {
    renderFolderPage('1');

    await waitFor(() => {
      expect(screen.getByText('Uploads')).toBeDefined();
      expect(screen.getByText('Nodes')).toBeDefined();
      expect(screen.getByText('Graph')).toBeDefined();
    });

    cleanup();
  });

  it('shows uploads tab by default', async () => {
    renderFolderPage('1');

    await waitFor(() => {
      // Uploads tab should be the default/first tab
      expect(screen.getByText('Uploads')).toBeDefined();
    });

    cleanup();
  });

  it('renders nothing for invalid folder id', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/folder/invalid']}>
          <Routes>
            <Route path="/folder/:folderId" element={<FolderPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.queryByText('Nodes')).toBeNull();
    cleanup();
  });
});
