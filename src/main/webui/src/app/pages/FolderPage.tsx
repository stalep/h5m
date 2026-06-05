import type { Node as ApiNode } from '@client/types.gen.ts';

import { DataTab } from '@app/components/DataTab';
import { NodeDetailPanel } from '@app/components/NodeDetailPanel';
import { NodeGraphVisualizer } from '@app/components/NodeGraphVisualizer';
import {
  Button,
  ErrorBoundary,
  InlineLoading,
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
import { Add } from '@carbon/icons-react';
import { byIdOptions, listFoldersOptions } from '@client/@tanstack/react-query.gen.ts';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Suspense, useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

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

/** Find a node by its string ID in the full node group tree */
function findNodeInGroup(nodeGroup: { root?: ApiNode; sources?: ApiNode[] }, nodeId: string): ApiNode | undefined {
  const id = Number(nodeId);
  const search = (node: ApiNode | undefined): ApiNode | undefined => {
    if (!node) return undefined;
    if (node.id === id) return node;
    for (const src of node.sources ?? []) {
      const found = search(src);
      if (found) return found;
    }
    return undefined;
  };
  let found = search(nodeGroup.root);
  if (!found) {
    for (const src of nodeGroup.sources ?? []) {
      found = search(src);
      if (found) break;
    }
  }
  return found;
}

const GraphVisualizer = ({ groupId }: { groupId: number }) => {
  const { data: nodeGroup } = useSuspenseQuery(byIdOptions({ path: { id: groupId } }));
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return undefined;
    return findNodeInGroup(nodeGroup, selectedNodeId);
  }, [selectedNodeId, nodeGroup]);

  // Select the root node to open the panel with expression tester
  const handleAddNode = useCallback(() => {
    if (nodeGroup.root?.id != null) {
      setSelectedNodeId(String(nodeGroup.root.id));
    }
  }, [nodeGroup]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 'var(--cds-spacing-03) 0' }}>
        <Button size="sm" kind="primary" renderIcon={Add} onClick={handleAddNode}>
          Add Node
        </Button>
      </div>
      <div style={{ display: 'flex', height: 'calc(100vh - 240px)' }}>
        <div style={{ flex: selectedNode ? '0 0 65%' : '1 1 100%', transition: 'flex 0.3s', minWidth: 0 }}>
          <NodeGraphVisualizer
            nodeGroup={nodeGroup}
            selectedNodeId={selectedNodeId}
            onNodeSelect={setSelectedNodeId}
          />
        </div>
        {selectedNode && (
          <div style={{ flex: '0 0 35%', minWidth: '300px', maxWidth: '500px' }}>
            <NodeDetailPanel
              key={selectedNode.id}
              node={selectedNode}
              nodeGroup={nodeGroup}
              groupId={groupId}
              onClose={() => setSelectedNodeId(undefined)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

const TAB_ANCHORS = ['data', 'nodes', 'graph'];

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
        <Tab>Data</Tab>
        <Tab>Nodes</Tab>
        <Tab>Graph</Tab>
      </TabList>
      <TabPanels>
        <TabPanel>
          {folder.name && folder.groupId != null ? (
            <DataTab folderName={folder.name} groupId={folder.groupId} />
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
