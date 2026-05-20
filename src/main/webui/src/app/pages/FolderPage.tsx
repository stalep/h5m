import type { Node as ApiNode, UploadSummary } from '@client/types.gen.ts';

import { NodeGraphVisualizer } from '@app/components/NodeGraphVisualizer';
import {
  CodeSnippet,
  ErrorBoundary,
  InlineLoading,
  Pagination,
  SkeletonText,
  StructuredListBody,
  StructuredListCell,
  StructuredListHead,
  StructuredListRow,
  StructuredListWrapper,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tag,
} from '@carbon/react';
import { byIdOptions, getUploadsOptions, getValueDataOptions, listFoldersOptions } from '@client/@tanstack/react-query.gen.ts';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Suspense, useCallback, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

function formatDate(date?: string | null): string {
  if (!date) return '—';
  try {
    const d = new Date(date);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return String(date);
  }
}

const NodesTab = ({ groupId }: { groupId: number }) => {
  const { data: nodeGroup } = useSuspenseQuery(byIdOptions({ path: { id: groupId } }));
  if (nodeGroup.sources?.length === 0) {
    return <p>No nodes defined</p>;
  }
  return (
    <StructuredListWrapper>
      <StructuredListHead>
        <StructuredListRow head>
          <StructuredListCell head>Name</StructuredListCell>
          <StructuredListCell head>Type</StructuredListCell>
          <StructuredListCell head>FQDN</StructuredListCell>
          <StructuredListCell head>Operation</StructuredListCell>
        </StructuredListRow>
      </StructuredListHead>
      <StructuredListBody>
        {nodeGroup.sources?.map((node: ApiNode) => (
          <StructuredListRow key={node.id}>
            <StructuredListCell>{node.name}</StructuredListCell>
            <StructuredListCell>
              <Tag size="sm">{node.type}</Tag>
            </StructuredListCell>
            <StructuredListCell>{node.fqdn}</StructuredListCell>
            <StructuredListCell>{node.operation}</StructuredListCell>
          </StructuredListRow>
        ))}
      </StructuredListBody>
    </StructuredListWrapper>
  );
};

const UploadDetail = ({ valueId }: { valueId: number }) => {
  const { data, isLoading, isError } = useQuery(
    getValueDataOptions({ path: { id: valueId } }),
  );

  if (isLoading) return <SkeletonText paragraph={true} lineCount={3} />;
  if (isError) return <InlineLoading status="error" description="Failed to load data" />;

  return (
    <div style={{ padding: 'var(--cds-spacing-03)', maxHeight: '400px', overflow: 'auto' }}>
      <CodeSnippet type="multi" wrapText>
        {JSON.stringify(data, null, 2)}
      </CodeSnippet>
    </div>
  );
};

const UploadsTab = ({ folderName }: { folderName: string }) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const offset = (page - 1) * pageSize;

  const { data: uploads, isLoading } = useQuery(
    getUploadsOptions({
      path: { name: folderName },
      query: { limit: pageSize, offset },
    }),
  );

  if (isLoading) {
    return <SkeletonText paragraph={true} lineCount={5} />;
  }

  if (!uploads || uploads.length === 0) {
    return <p>No uploads yet</p>;
  }

  return (
    <>
      <StructuredListWrapper>
        <StructuredListHead>
          <StructuredListRow head>
            <StructuredListCell head>ID</StructuredListCell>
            <StructuredListCell head>Uploaded</StructuredListCell>
            <StructuredListCell head>Values</StructuredListCell>
          </StructuredListRow>
        </StructuredListHead>
        <StructuredListBody>
          {uploads.map((upload: UploadSummary) => (
            <span key={upload.id}>
              <StructuredListRow
                onClick={() => setExpandedId(expandedId === upload.id ? null : (upload.id ?? null))}
                style={{ cursor: 'pointer' }}
              >
                <StructuredListCell>
                  {expandedId === upload.id ? '▼' : '▶'} {upload.id}
                </StructuredListCell>
                <StructuredListCell>
                  {formatDate(upload.createdAt as unknown as string)}
                </StructuredListCell>
                <StructuredListCell>{upload.valueCount ?? 0}</StructuredListCell>
              </StructuredListRow>
              {expandedId === upload.id && upload.id != null && (
                <div style={{ padding: 'var(--cds-spacing-03) var(--cds-spacing-05)' }}>
                  <UploadDetail valueId={upload.id} />
                </div>
              )}
            </span>
          ))}
        </StructuredListBody>
      </StructuredListWrapper>
      <Pagination
        page={page}
        pageSize={pageSize}
        pageSizes={[10, 25, 50, 100]}
        totalItems={uploads.length < pageSize ? offset + uploads.length : offset + pageSize + 1}
        onChange={({ page: newPage, pageSize: newSize }: { page: number; pageSize: number }) => {
          setPage(newPage);
          setPageSize(newSize);
        }}
      />
    </>
  );
};

const GraphVisualizer = ({ groupId }: { groupId: number }) => {
  const { data: nodeGroup } = useSuspenseQuery(byIdOptions({ path: { id: groupId } }));
  return <NodeGraphVisualizer nodeGroup={nodeGroup} />;
};

const TAB_ANCHORS = ['uploads', 'nodes', 'graph'];

const FolderContent = ({ folderId }: { folderId: number }) => {
  const { data: folders } = useSuspenseQuery(listFoldersOptions());
  const folder = folders.find((f) => f.id === folderId);
  const navigate = useNavigate();
  const location = useLocation();
  const selectedIndex = Math.max(0, TAB_ANCHORS.indexOf(location.hash.slice(1)));
  const onTabChange = useCallback(({ selectedIndex: i }: { selectedIndex: number }) => {
    void navigate({ hash: TAB_ANCHORS[i] }, { replace: true });
  }, [navigate]);
  if (!folder) {
    return <InlineLoading status="error" description="Folder not found" />;
  }
  return (
    <Tabs selectedIndex={selectedIndex} onChange={onTabChange}>
      <TabList aria-label="Folder tabs">
        <Tab>Uploads</Tab>
        <Tab>Nodes</Tab>
        <Tab>Graph</Tab>
      </TabList>
      <TabPanels>
        <TabPanel>
          {folder.name ? (
            <UploadsTab folderName={folder.name} />
          ) : (
            <p>Folder name not available</p>
          )}
        </TabPanel>
        <TabPanel>
          {folder.groupId != null ? (
            <ErrorBoundary fallback={<InlineLoading status="error" description="Failed to load nodes" />}>
              <Suspense fallback={<SkeletonText paragraph={true} lineCount={5} />}>
                <NodesTab groupId={folder.groupId} />
              </Suspense>
            </ErrorBoundary>
          ) : (
            <p>No node group associated with this folder</p>
          )}
        </TabPanel>
        <TabPanel>
          {folder.groupId != null ? (
            <ErrorBoundary fallback={<InlineLoading status="error" description="Failed to load nodes" />}>
              <Suspense fallback={<SkeletonText paragraph={true} lineCount={5} />}>
                <GraphVisualizer groupId={folder.groupId} />
              </Suspense>
            </ErrorBoundary>
          ) : (
            <p>No node group associated with this folder</p>
          )}
        </TabPanel>
      </TabPanels>
    </Tabs>
  );
};

export const FolderPage = () => {
  const { folderId } = useParams<{ folderId: string }>();
  const id = Number(folderId);
  if (!folderId || isNaN(id)) {
    return null;
  }
  return (
    <div style={{ padding: 'var(--cds-spacing-05)', marginTop: 'var(--cds-spacing-09)' }}>
      <ErrorBoundary fallback={<InlineLoading status="error" description="Failed to load folder" />}>
        <Suspense fallback={<SkeletonText paragraph={true} lineCount={5} />}>
          <FolderContent folderId={id} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
};
