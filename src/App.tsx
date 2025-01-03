import { useEffect } from 'react';
import { 
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  NodeOrigin,
  useReactFlow,
  Connection,
  IsValidConnection,
  Viewport
} from '@xyflow/react';
import { shallow } from 'zustand/shallow';
import { useNodeState, NodeState, CustomNodeType } from './stores/nodeStore';

import { nanoid } from 'nanoid';
import CustomNode from './components/CustomNode';

import '@xyflow/react/dist/base.css';
import './app.css';

const nodeTypes = {
  custom: CustomNode,
};

const selectNodeState = (state: NodeState) => ({
  nodes: state.nodes,
  edges: state.edges,
  onNodesChange: state.onNodesChange,
  onEdgesChange: state.onEdgesChange,
  onEdgeDoubleClick: state.onEdgeDoubleClick,
  onConnect: state.onConnect,
  addNode: state.addNode,
  getParam: state.getParam,
  initializeNodes: state.initializeNodes,
});

const nodeOrigin: NodeOrigin = [0.5, 0.5];
const connectionLineStyle = { strokeWidth: 3, strokeDasharray: '8,8' };
const defaultEdgeOptions = { style: { ...connectionLineStyle, strokeDasharray: 'none' } };

export default function App() {
  const { nodes, edges, onNodesChange, onEdgesChange, onEdgeDoubleClick, onConnect, addNode, getParam, initializeNodes } = useNodeState(selectNodeState, shallow);
  const { screenToFlowPosition, setNodes, setEdges, setViewport } = useReactFlow();

  const onMoveEnd = (_: MouseEvent | TouchEvent | null, viewport: Viewport) => {
    // Optional: Add any viewport change handling here if needed
  };

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onEdgeDoubleClick={onEdgeDoubleClick}
      onConnect={onConnect}
      onMoveEnd={onMoveEnd}
      nodeTypes={nodeTypes}
      fitView
    >
      <Background />
      <Controls />
    </ReactFlow>
  );
}
