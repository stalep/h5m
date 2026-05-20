import type { Node as ApiNode, UploadSummary } from '@client/types.gen.ts';

import type { CreateNodeRequest } from '@app/components/ExpressionTester';

import { ExpressionTester } from '@app/components/ExpressionTester';
import { NodeGraphVisualizer } from '@app/components/NodeGraphVisualizer';
import {
  Button,
  CodeSnippet,
  ComposedModal,
  ErrorBoundary,
  InlineLoading,
  ModalBody,
  ModalFooter,
  ModalHeader,
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
  TextInput,
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

const NODE_TYPE_MAP: Record<string, string> = {
  jq: 'JQ',
  js: 'JS',
};

const CreateNodeModal = ({
  open,
  request,
  folderId,
  onClose,
}: {
  open: boolean;
  request: CreateNodeRequest | null;
  folderId: number;
  onClose: () => void;
}) => {
  const [nodeName, setNodeName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!request || !nodeName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const nodeType = NODE_TYPE_MAP[request.type] ?? 'JQ';
      const params = new URLSearchParams({
        name: nodeName,
        groupId: String(folderId),
        type: nodeType,
        operation: request.expression,
      });
      const response = await fetch(`/api/node?${params.toString()}`, {
        method: 'POST',
      });
      if (!response.ok) {
        const text = await response.text();
        setError(text || `HTTP ${String(response.status)}`);
      } else {
        setSuccess(true);
        setTimeout(() => {
          onClose();
          setSuccess(false);
          setNodeName('');
        }, 1000);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create node');
    } finally {
      setCreating(false);
    }
  }, [request, nodeName, folderId, onClose]);

  return (
    <ComposedModal open={open} onClose={() => { onClose(); setNodeName(''); setError(null); setSuccess(false); }}>
      <ModalHeader title="Create Node" />
      <ModalBody>
        <TextInput
          id="node-name"
          labelText="Node name"
          placeholder="e.g., cpu, throughput, version"
          value={nodeName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNodeName(e.target.value)}
          disabled={creating || success}
        />
        {request && (
          <div style={{ marginTop: 'var(--cds-spacing-05)' }}>
            <p style={{ fontSize: '0.75rem', opacity: 0.7 }}>Type: <strong>{request.type}</strong></p>
            <p style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: 'var(--cds-spacing-02)' }}>Expression:</p>
            <CodeSnippet type="single">{request.expression}</CodeSnippet>
          </div>
        )}
        {error && (
          <div style={{ color: 'var(--cds-support-error)', marginTop: 'var(--cds-spacing-03)' }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ color: 'var(--cds-support-success)', marginTop: 'var(--cds-spacing-03)' }}>
            Node created successfully!
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={() => { onClose(); setNodeName(''); setError(null); }}>Cancel</Button>
        <Button
          kind="primary"
          onClick={() => void handleCreate()}
          disabled={creating || !nodeName.trim() || success}
        >
          {creating ? 'Creating...' : 'Create'}
        </Button>
      </ModalFooter>
    </ComposedModal>
  );
};

const UploadDetail = ({ valueId, folderId }: { valueId: number; folderId: number }) => {
  const { data, isLoading, isError } = useQuery(
    getValueDataOptions({ path: { id: valueId } }),
  );
  const [showTester, setShowTester] = useState(false);
  const [createRequest, setCreateRequest] = useState<CreateNodeRequest | null>(null);

  if (isLoading) return <SkeletonText paragraph={true} lineCount={3} />;
  if (isError) return <InlineLoading status="error" description="Failed to load data" />;

  return (
    <div style={{ padding: 'var(--cds-spacing-03)' }}>
      <div style={{ display: 'flex', gap: 'var(--cds-spacing-03)', marginBottom: 'var(--cds-spacing-03)' }}>
        <Tag size="sm" type={showTester ? 'blue' : 'gray'}
          onClick={() => setShowTester(!showTester)}
          style={{ cursor: 'pointer' }}>
          {showTester ? 'Hide expression tester' : 'Try expression'}
        </Tag>
      </div>
      {showTester && (
        <ExpressionTester
          valueId={valueId}
          data={data}
          onCreateNode={(req) => setCreateRequest(req)}
        />
      )}
      <CreateNodeModal
        open={createRequest != null}
        request={createRequest}
        folderId={folderId}
        onClose={() => setCreateRequest(null)}
      />
      <div style={{ maxHeight: '400px', overflow: 'auto' }}>
        <CodeSnippet type="multi" wrapText>
          {JSON.stringify(data, null, 2)}
        </CodeSnippet>
      </div>
    </div>
  );
};

const UploadsTab = ({ folderName, folderId }: { folderName: string; folderId: number }) => {
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
                  <UploadDetail valueId={upload.id} folderId={folderId} />
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
            <UploadsTab folderName={folder.name} folderId={folder.groupId ?? 0} />
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
