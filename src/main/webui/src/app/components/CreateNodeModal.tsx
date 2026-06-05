import type { CreateNodeRequest } from '@app/components/ExpressionTester';

import {
  Button,
  CodeSnippet,
  ComposedModal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextInput,
} from '@carbon/react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

const NODE_TYPE_MAP: Record<string, string> = {
  jq: 'JQ',
  js: 'JS',
};

interface CreateNodeModalProps {
  open: boolean;
  onClose: () => void;
  groupId: number;
  /** The expression and type from the expression tester */
  request: CreateNodeRequest | null;
  /** Parent node ID — the new node will have this as its source */
  parentNodeId?: number;
}

export const CreateNodeModal = ({ open, onClose, groupId, request, parentNodeId }: CreateNodeModalProps) => {
  const queryClient = useQueryClient();
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
        groupId: String(groupId),
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
        // Invalidate the node group query so the graph refreshes
        queryClient.invalidateQueries({ queryKey: ['byId'] });
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
  }, [request, nodeName, groupId, parentNodeId, onClose, queryClient]);

  const handleClose = useCallback(() => {
    onClose();
    setNodeName('');
    setError(null);
    setSuccess(false);
  }, [onClose]);

  return (
    <ComposedModal open={open} onClose={handleClose} size="sm">
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
        <Button kind="secondary" onClick={handleClose}>Cancel</Button>
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
