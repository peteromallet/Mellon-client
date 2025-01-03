import {
    Edge,
    Node,
    OnConnect,
    NodeChange,
    EdgeChange,
    OnNodesChange,
    OnEdgesChange,
    applyNodeChanges,
    applyEdgeChanges,
    Connection,
    getOutgoers,
    getIncomers,
} from '@xyflow/react';
import { createWithEqualityFn } from 'zustand/traditional';
import { nanoid } from 'nanoid';

import config from '../../config';

type NodeParams = {
    type?: string | string[];
    label?: string;
    display?: string;
    value?: any;
    options?: string | string[];
    default?: any;
    description?: string;
    source?: string;
    min?: number;
    max?: number;
    step?: number;
    group?: string | { [key: string]: string };
    style?: { [key: string]: string };
    connections?: Array<{ targetId: string; targetParam: string }>;
};

type NodeData = {
    module: string;
    action: string;
    category: string;
    params: { [key: string]: NodeParams };
    cache?: boolean;
    time?: number;
    memory?: number;
    label?: string;
    description?: string;
    style?: { [key: string]: string };
};

type StoredWorkflow = {
    nodes: CustomNodeType[];
    edges: Edge[];
    viewport?: { x: number; y: number; zoom: number };
  };

export type CustomNodeType = Node<NodeData, 'custom'>;

// Data format for API export
type APINodeData = {
    // TODO: we also need a workflow id probably
    module: string;
    action: string;
    params: {
        [key: string]: {
            sourceId?: string,
            sourceKey?: string,
            value?: any,
            display?: string,
            type?: string | string[]
        }
    };
};

type GraphExport = {
    sid: string;
    nodes: { [key: string]: APINodeData };
    paths: string[][];
};

type CustomComponent = CustomNodeType;

const formatAPIData = (node: CustomNodeType, edge: Edge[]): APINodeData => {
    const inputEdges = edge.filter(e => e.target === node.id);
    const params: APINodeData['params'] = {};

    Object.entries(node.data.params).forEach(([key, param]) => {
        // We don't need to export output parameters
        if (param.display === 'output') {
            return;
        }

        const edge = inputEdges.find(e => e.targetHandle === key);

        params[key] = {
            sourceId: edge?.source ?? undefined,
            sourceKey: (edge ? edge.sourceHandle : param.source) ?? undefined,
            value: param.value ?? undefined,
            display: param.display ?? undefined,
            type: param.type ?? undefined
        };
    });

    return {
        module: node.data.module,
        action: node.data.action,
        params
    };
};

/*
const findOutputNode = (nodes: CustomNodeType[], edges: Edge[]): CustomNodeType[] => {
    const outputNodes = new Set(edges.map(edge => edge.source));
    return nodes.filter(node => !outputNodes.has(node.id));
};
*/

const buildPath = (
    currentNode: string,
    nodes: CustomNodeType[],
    edges: Edge[],
    visited: Set<string> = new Set()
): string[] => {
    if (visited.has(currentNode)) return []; // Prevent cycles
    visited.add(currentNode);

    // Get all incoming edges to this node
    //const incomingEdges = edges.filter(edge => edge.target === currentNode);
    const node = nodes.find(n => n.id === currentNode);
    if (!node) return [];
    
    const incomingNodes = getIncomers(node, nodes, edges);

    // If this is an input node (no incoming edges), return just this node
    if (incomingNodes.length === 0) {
        return [currentNode];
    }

    const inputPaths = incomingNodes.flatMap(sourceNode =>
        buildPath(sourceNode.id, nodes, edges, new Set(visited))
    );

    return [...inputPaths, currentNode];
};

export type NodeState = {
    nodes: CustomNodeType[];
    edges: Edge[];
    onNodesChange: OnNodesChange<CustomNodeType>;
    onEdgesChange: OnEdgesChange;
    onEdgeDoubleClick: (id: string) => void;
    onConnect: OnConnect;
    addNode: (node: CustomNodeType) => void;
    setParamValue: (nodeId: string, paramName: string, value: any) => void;
    getParam: (nodeId: string, paramName: string) => any;
    setNodeExecuted: (id: string, cache: boolean, time: number, memory: number) => void;
    exportGraph: (sid: string) => GraphExport;
    initializeNodes: () => void;
};

interface NodeStore {
    setParamValue: (nodeId: string, paramName: string, value: any) => void;
    getParam: (nodeId: string, paramName: string) => any;
}

export const useNodeState = createWithEqualityFn<NodeState>((set, get) => ({
    nodes: [],
    edges: [],
    onNodesChange: async (changes: NodeChange<CustomNodeType>[]) => {
        const newNodes = applyNodeChanges(changes, get().nodes);
        set({ nodes: newNodes });
        
        // delete the server cache for the deleted nodes
        if (changes.some(change => change.type === 'remove')) {
            const nodeIds = changes.filter(change => change.type === 'remove').map(change => change.id);
            try {
                await fetch('http://' + config.serverAddress + '/clearNodeCache', {
                    method: 'DELETE',
                    body: JSON.stringify({ nodeId: nodeIds }),
                });
            } catch (error) {
                console.error('Can\'t connect to server to clear cache:', error);
            }
        }
    },
    onEdgesChange: (changes: EdgeChange<Edge>[]) => {
        const newEdges = applyEdgeChanges(changes, get().edges);
        set({ edges: newEdges });
    },
    onEdgeDoubleClick: (id: string) => {
        const updatedEdges = get().edges.filter((edge) => edge.id !== id);
        set({ edges: updatedEdges });
    },
    onConnect: (conn: Connection) => {
        console.log('Creating new connection:', conn);
        const sourceNode = get().nodes.find(node => node.id === conn.source);
        const targetNode = get().nodes.find(node => node.id === conn.target);
        
        console.log('Source node:', sourceNode);
        console.log('Target node:', targetNode);
        
        const updatedEdges = get().edges.filter(
            edge => !(edge.target === conn.target && edge.targetHandle === conn.targetHandle)
        );
        const newEdge = { ...conn, id: nanoid() };
        const newEdges = [...updatedEdges, newEdge];
        console.log('New edges after connection:', newEdges);
        set({ edges: newEdges });

        // If we have both nodes, set up the data connection
        if (sourceNode && targetNode && conn.sourceHandle && conn.targetHandle) {
            // Get the current value from the source node's params
            const sourceParam = sourceNode.data.params[conn.sourceHandle];
            console.log('Source param to transfer:', sourceParam);
            
            // Update the target node with the source value
            if (sourceParam?.value !== undefined) {
                get().setParamValue(targetNode.id, conn.targetHandle, sourceParam.value);
            }

            // Store the connection info for future updates
            const sourceHandle = conn.sourceHandle;
            const targetHandle = conn.targetHandle;
            
            set((state: NodeState) => {
                const updatedNodes = state.nodes.map(node => {
                    if (node.id === sourceNode.id) {
                        const currentParams = node.data.params[sourceHandle] || {};
                        const currentConnections = currentParams.connections || [];
                        
                        return {
                            ...node,
                            data: {
                                ...node.data,
                                params: {
                                    ...node.data.params,
                                    [sourceHandle]: {
                                        ...currentParams,
                                        connections: [
                                            ...currentConnections,
                                            { targetId: targetNode.id, targetParam: targetHandle }
                                        ]
                                    }
                                }
                            }
                        };
                    }
                    return node;
                });
                return { ...state, nodes: updatedNodes };
            });
        }
    },
    addNode: (node: CustomNodeType) => {
        if (node.data?.params) {
            Object.keys(node.data.params).forEach(key => {
                const param = node.data.params[key];
                node.data.params[key] = {
                    ...param,
                    value: param.value ?? param.default
                };
            });
        }
        const newNodes = [...get().nodes, node];
        set({ nodes: newNodes });
    },
    setParamValue: (nodeId: string, paramName: string, value: any) => {
        set((state: NodeState) => {
            const nodes = [...state.nodes];
            const nodeIndex = nodes.findIndex((n) => n.id === nodeId);
            if (nodeIndex === -1) return state;

            const currentNode = nodes[nodeIndex];
            if (!currentNode.data) {
                currentNode.data = {
                    module: '',
                    action: '',
                    category: '',
                    params: {}
                };
            }
            if (!currentNode.data.params) {
                currentNode.data.params = {};
            }
            
            const currentParam = currentNode.data.params[paramName] || {};
            currentNode.data.params[paramName] = {
                ...currentParam,
                value: value
            };
            
            console.log(`Parameter set - Node: ${nodeId}, Param: ${paramName}`, value);

            // Propagate updates to connected nodes
            const edges = state.edges;
            edges.forEach(edge => {
                if (edge.source === nodeId && edge.sourceHandle === paramName) {
                    const targetNode = nodes.find(n => n.id === edge.target);
                    if (targetNode && edge.targetHandle) {
                        // Update the target node's parameter
                        const targetNodeIndex = nodes.findIndex(n => n.id === edge.target);
                        if (targetNodeIndex !== -1) {
                            const targetParam = nodes[targetNodeIndex].data.params[edge.targetHandle] || {};
                            nodes[targetNodeIndex].data.params[edge.targetHandle] = {
                                ...targetParam,
                                value: value
                            };
                            console.log(`Propagated value to connected node ${edge.target}, param ${edge.targetHandle}:`, value);
                        }
                    }
                }
            });

            return { ...state, nodes };
        });
    },
    getParam: (nodeId, paramName) => {
        const state = get();
        const node = state.nodes.find((n) => n.id === nodeId);
        if (!node?.data?.params) return null;
        console.log(`Getting param ${paramName} for node ${nodeId}:`, node.data.params[paramName]);
        return node.data.params[paramName];
    },
    setNodeExecuted: (id: string, cache: boolean, time: number, memory: number) => {
        set({ nodes: get().nodes.map(node => (node.id === id ? { ...node, data: { ...node.data, cache, time, memory } } : node)) });
    },
    exportGraph: (sid: string) => {
        const { nodes, edges } = get();
        const outputNodes = nodes.filter(node => getOutgoers(node, nodes, edges).length === 0); //findOutputNode(nodes, edges);
        const paths = outputNodes.map(node => buildPath(node.id, nodes, edges));

        const nodesLookup = nodes.reduce((acc, node) => ({
            ...acc,
            [node.id]: formatAPIData(node, edges)
        }), {});

        const graphData: GraphExport = {
            sid: sid ?? '',
            nodes: nodesLookup,
            paths
        };

        return graphData;
    },
    initializeNodes: () => {
        console.log('Running initializeNodes');
        const customComponents: CustomComponent[] = [
            {
                id: nanoid(),
                type: 'custom',
                position: { x: 100, y: 100 },
                data: {
                    module: 'custom_components',
                    action: 'MusicKeyboardTracker',
                    category: 'audio',
                    label: 'Music Keyboard Tracker',
                    params: {
                        component: {
                            type: 'component',
                            display: 'component',
                            value: 'MusicKeyboardTracker',
                            label: 'Music Keyboard Tracker'
                        },
                        timestamps: {
                            type: 'array',
                            display: 'output',
                            label: 'Timestamps'
                        }
                    }
                }
            },
            {
                id: nanoid(),
                type: 'custom',
                position: { x: 500, y: 100 },
                data: {
                    module: 'custom_components',
                    action: 'TimestampDisplay',
                    category: 'display',
                    label: 'Timestamp Display',
                    params: {
                        component: {
                            type: 'component',
                            display: 'component',
                            value: 'TimestampDisplay',
                            label: 'Timestamp Display'
                        },
                        timestamps: {
                            type: 'array',
                            display: 'input',
                            label: 'Timestamps',
                            value: []
                        }
                    }
                }
            },
            {
                id: nanoid(),
                type: 'custom',
                position: { x: 900, y: 100 },
                data: {
                    module: 'custom_components',
                    action: 'AddImagesToTimeline',
                    category: 'media',
                    label: 'Timeline Images',
                    params: {
                        component: {
                            type: 'component',
                            display: 'component',
                            value: 'AddImagesToTimeline',
                            label: 'Timeline Images'
                        },
                        timestamps: {
                            type: 'array',
                            display: 'input',
                            label: 'Timestamps',
                            value: []
                        }
                    }
                }
            }
        ];

        customComponents.forEach(node => {
            console.log('Adding node:', node);
            get().addNode(node);
        });
    }
}));
