import type { Node as ApiNode, NodeGroup } from '@client/types.gen.ts';
import type { CreateNodeRequest } from '@app/components/ExpressionTester';

import { CreateNodeModal } from '@app/components/CreateNodeModal';
import { ExpressionTester } from '@app/components/ExpressionTester';
import { nodeColor } from '@app/components/NodeGraphVisualizer';
import {
  Button,
  CodeSnippet,
  InlineLoading,
  SkeletonText,
  Tag,
} from '@carbon/react';
import { Add, Close, TrashCan } from '@carbon/icons-react';
import { getNodeValuesOptions, getValueDataOptions } from '@client/@tanstack/react-query.gen.ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

interface NodeDetailPanelProps {
  /** The selected node from the graph */
  node: ApiNode;
  /** The full node group (for resolving source names, root node) */
  nodeGroup: NodeGroup;
  /** Group ID for node creation */
  groupId: number;
  /** Called to close the panel */
  onClose: () => void;
}

/** Recursively find a node by ID in the node group tree */
function findNodeById(node: ApiNode | undefined, id: number): ApiNode | undefined {
  if (!node) return undefined;
  if (node.id === id) return node;
  for (const src of node.sources ?? []) {
    const found = findNodeById(src, id);
    if (found) return found;
  }
  return undefined;
}

export const NodeDetailPanel = ({ node, nodeGroup, groupId, onClose }: NodeDetailPanelProps) => {
  const queryClient = useQueryClient();
  const isRoot = node.type === 'ROOT';

  // Fetch values for this node
  const { data: values, isLoading: valuesLoading } = useQuery({
    ...getNodeValuesOptions({ path: { nodeId: node.id! } }),
    enabled: node.id != null,
  });

  // For root nodes, get the first upload's data for the expression tester
  const firstValueId = values?.[0]?.id;
  const { data: firstValueData } = useQuery({
    ...getValueDataOptions({ path: { id: firstValueId ?? 0 } }),
    enabled: firstValueId != null,
  });

  // For non-root nodes, get the node's first computed value data for display
  // (the expression tester for child nodes uses the parent's data)
  const parentNode = useMemo(() => {
    const sources = node.sources;
    if (isRoot || !sources || sources.length === 0) return undefined;
    const firstSource = sources[0];
    if (!firstSource) return undefined;
    const parentId = firstSource.id;
    if (parentId == null) return undefined;
    // Find the parent in the node group
    let found = findNodeById(nodeGroup.root, parentId);
    if (!found) {
      for (const src of nodeGroup.sources ?? []) {
        found = findNodeById(src, parentId);
        if (found) break;
      }
    }
    return found;
  }, [node, nodeGroup, isRoot]);

  // Get parent node's values for the expression tester input
  const { data: parentValues } = useQuery({
    ...getNodeValuesOptions({ path: { nodeId: parentNode?.id ?? 0 } }),
    enabled: parentNode?.id != null,
  });
  const parentFirstValueId = parentValues?.[0]?.id;
  const { data: parentFirstValueData } = useQuery({
    ...getValueDataOptions({ path: { id: parentFirstValueId ?? 0 } }),
    enabled: parentFirstValueId != null,
  });

  // Expression tester state
  const [showTester, setShowTester] = useState(false);
  const [createRequest, setCreateRequest] = useState<CreateNodeRequest | null>(null);

  // Delete mutation
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/node/${String(node.id)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(`Delete failed: ${String(response.status)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['byId'] });
      onClose();
    },
  });

  // Determine the expression tester input:
  // - Root node: use the root's upload data
  // - Non-root: use the parent node's computed data (what a child would receive)
  const testerValueId = isRoot ? firstValueId : parentFirstValueId;
  const testerData = isRoot ? firstValueData : parentFirstValueData;

  const handleCreateNode = useCallback((req: CreateNodeRequest) => {
    setCreateRequest(req);
  }, []);

  // Find dependent nodes (nodes that have this node as a source)
  const dependentNodes = useMemo(() => {
    const deps: ApiNode[] = [];
    const checkNode = (n: ApiNode) => {
      if (n.sources?.some(s => s.id === node.id)) {
        deps.push(n);
      }
      n.sources?.forEach(checkNode);
    };
    nodeGroup.sources?.forEach(checkNode);
    return deps;
  }, [node, nodeGroup]);

  return (
    <div style={{
      padding: 'var(--cds-spacing-05)',
      borderLeft: '1px solid var(--cds-border-subtle)',
      height: '100%',
      overflow: 'auto',
      background: 'var(--cds-layer)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--cds-spacing-05)' }}>
        <div>
          <h4 style={{ margin: 0 }}>{node.name ?? 'root'}</h4>
          <Tag size="sm" style={{ marginTop: '4px', background: nodeColor(node.type) }}>
            {node.type}
          </Tag>
        </div>
        <Button kind="ghost" size="sm" hasIconOnly renderIcon={Close} iconDescription="Close" onClick={onClose} />
      </div>

      {/* Operation */}
      {node.operation && (
        <div style={{ marginBottom: 'var(--cds-spacing-05)' }}>
          <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '4px' }}>Operation</div>
          <CodeSnippet type="single">{node.operation}</CodeSnippet>
        </div>
      )}

      {/* Sources */}
      {node.sources && node.sources.length > 0 && (
        <div style={{ marginBottom: 'var(--cds-spacing-05)' }}>
          <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '4px' }}>Sources</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {node.sources.map(s => (
              <Tag key={s.id} size="sm" type="gray">{s.name ?? 'root'}</Tag>
            ))}
          </div>
        </div>
      )}

      {/* Values */}
      <div style={{ marginBottom: 'var(--cds-spacing-05)' }}>
        <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '4px' }}>
          Values {values ? `(${String(values.length)})` : ''}
        </div>
        {valuesLoading && <SkeletonText paragraph={true} lineCount={2} />}
        {values && values.length === 0 && <p style={{ fontSize: '0.875rem', opacity: 0.7 }}>No values</p>}
        {values && values.length > 0 && (
          <div style={{ maxHeight: '150px', overflow: 'auto' }}>
            {values.slice(0, 5).map((v) => (
              <div key={v.id} style={{ fontSize: '0.75rem', padding: '2px 0', borderBottom: '1px solid var(--cds-border-subtle)' }}>
                <span style={{ opacity: 0.5 }}>#{String(v.id)}</span>{' '}
                {v.data != null ? (typeof v.data === 'object' ? JSON.stringify(v.data).substring(0, 80) : String(v.data)) : '—'}
                {v.data != null && typeof v.data === 'object' && JSON.stringify(v.data).length > 80 ? '...' : ''}
              </div>
            ))}
            {values.length > 5 && (
              <div style={{ fontSize: '0.75rem', opacity: 0.5, padding: '4px 0' }}>
                ...and {String(values.length - 5)} more
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 'var(--cds-spacing-03)', marginBottom: 'var(--cds-spacing-05)' }}>
        <Button
          size="sm"
          kind="tertiary"
          renderIcon={Add}
          onClick={() => setShowTester(!showTester)}
        >
          {showTester ? 'Hide tester' : 'Add child node'}
        </Button>
        {!isRoot && (
          <Button
            size="sm"
            kind="danger--ghost"
            renderIcon={TrashCan}
            onClick={() => setConfirmDelete(true)}
            disabled={deleteMutation.isPending}
          >
            Delete
          </Button>
        )}
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div style={{
          padding: 'var(--cds-spacing-03)',
          marginBottom: 'var(--cds-spacing-05)',
          border: '1px solid var(--cds-support-error)',
          borderRadius: '4px',
        }}>
          <p style={{ fontSize: '0.875rem', marginBottom: 'var(--cds-spacing-03)' }}>
            Delete <strong>{node.name}</strong>?
          </p>
          {dependentNodes.length > 0 && (
            <p style={{ fontSize: '0.75rem', color: 'var(--cds-support-error)', marginBottom: 'var(--cds-spacing-03)' }}>
              This will also delete {String(dependentNodes.length)} dependent node{dependentNodes.length > 1 ? 's' : ''}:{' '}
              {dependentNodes.map(d => d.name).join(', ')}
            </p>
          )}
          <div style={{ display: 'flex', gap: 'var(--cds-spacing-03)' }}>
            <Button size="sm" kind="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button
              size="sm"
              kind="danger"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Confirm delete'}
            </Button>
          </div>
        </div>
      )}

      {/* Expression tester */}
      {showTester && testerValueId != null && (
        <div style={{ marginBottom: 'var(--cds-spacing-05)' }}>
          <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '4px' }}>
            {isRoot ? 'Test against upload data' : `Test against ${parentNode?.name ?? 'parent'} output`}
          </div>
          <ExpressionTester
            valueId={testerValueId}
            data={testerData}
            onCreateNode={handleCreateNode}
          />
        </div>
      )}
      {showTester && testerValueId == null && (
        <div style={{ padding: 'var(--cds-spacing-03)' }}>
          <InlineLoading status={valuesLoading ? 'active' : 'error'}
            description={valuesLoading ? 'Loading values...' : 'No upload data available to test against'} />
        </div>
      )}

      {/* Create node modal */}
      <CreateNodeModal
        open={createRequest != null}
        onClose={() => setCreateRequest(null)}
        groupId={groupId}
        request={createRequest}
        parentNodeId={node.id}
      />
    </div>
  );
};
