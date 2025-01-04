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
import { dataService } from '../services/dataService';

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
    files?: string[];
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
    deleteNodeData: (nodeId: string) => Promise<void>;
    loadNodeData: (nodeId: string) => Promise<void>;
    saveNodeData: (nodeId: string) => Promise<void>;
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
            
            // First state update - update target node's parameter value
            set((state: NodeState) => {
                const updatedNodes = state.nodes.map(node => {
                    if (node.id === targetNode.id) {
                        const targetHandle = conn.targetHandle as string;
                        const updatedParams = {
                            ...node.data.params,
                            [targetHandle]: {
                                ...node.data.params[targetHandle],
                                value: sourceParam?.value
                            }
                        };

                        return {
                            ...node,
                            data: {
                                ...node.data,
                                params: updatedParams
                            }
                        };
                    }
                    return node;
                });
                return { ...state, nodes: updatedNodes };
            });

            // Second state update - store connection info in source node
            set((state: NodeState) => {
                const updatedNodes = state.nodes.map(node => {
                    if (node.id === sourceNode.id && conn.targetHandle) {
                        const sourceHandle = conn.sourceHandle as string;
                        const currentParams = node.data.params[sourceHandle] || {};
                        const currentConnections = currentParams.connections || [];
                        
                        const updatedParams = {
                            ...node.data.params,
                            [sourceHandle]: {
                                ...currentParams,
                                connections: [
                                    ...currentConnections,
                                    { targetId: targetNode.id, targetParam: conn.targetHandle }
                                ]
                            }
                        } as NodeData['params'];

                        return {
                            ...node,
                            data: {
                                ...node.data,
                                params: updatedParams
                            }
                        };
                    }
                    return node;
                });
                return { ...state, nodes: updatedNodes };
            });

            // Save both nodes' data after all state updates are complete
            get().saveNodeData(targetNode.id);
            get().saveNodeData(sourceNode.id);
        }
    },
    addNode: async (node: CustomNodeType) => {
        set((state: NodeState) => {
            const newNodes = [...state.nodes, node];
            return { ...state, nodes: newNodes };
        });

        // Load any existing data for this node
        try {
            const nodeData = await dataService.loadNodeData(node.id);
            if (nodeData?.params) {
                // Update the node with persisted data
                set((state: NodeState) => ({
                    ...state,
                    nodes: state.nodes.map(n => {
                        if (n.id === node.id) {
                            return {
                                ...n,
                                data: {
                                    ...n.data,
                                    params: Object.fromEntries(
                                        Object.entries(n.data.params).map(([key, param]) => [
                                            key,
                                            {
                                                ...param,
                                                value: nodeData.params[key]?.value ?? param.value ?? param.default
                                            }
                                        ])
                                    ),
                                    cache: nodeData.cache,
                                    time: nodeData.time,
                                    memory: nodeData.memory
                                }
                            };
                        }
                        return n;
                    })
                }));
            }
        } catch (error) {
            console.error(`Error loading persisted data for node ${node.id}:`, error);
        }
    },
    setParamValue: async (nodeId: string, paramName: string, value: any) => {
        let updatedNodes: CustomNodeType[] = [];
        
        // First update the source node and collect nodes that need updating
        set((state: NodeState) => {
            updatedNodes = state.nodes.map(node => {
                if (node.id === nodeId) {
                    // Update the source node
                    const currentParam = node.data.params[paramName];
                    const connections = currentParam?.connections || [];
                    
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            params: {
                                ...node.data.params,
                                [paramName]: {
                                    ...node.data.params[paramName],
                                    value
                                }
                            }
                        }
                    };
                }
                return node;
            });
            return { ...state, nodes: updatedNodes };
        });

        // Find the source node and its connections after the state update
        const sourceNode = updatedNodes.find(n => n.id === nodeId);
        const connections = sourceNode?.data.params[paramName]?.connections;
        
        // Update all connected target nodes if there are connections
        if (connections?.length) {
            // Update all connected target nodes
            set((state: NodeState) => {
                const nodesWithPropagatedValues = state.nodes.map(node => {
                    // Check if this node is a target of the source parameter
                    const connection = connections.find(conn => conn.targetId === node.id);
                    if (connection) {
                        return {
                            ...node,
                            data: {
                                ...node.data,
                                params: {
                                    ...node.data.params,
                                    [connection.targetParam]: {
                                        ...node.data.params[connection.targetParam],
                                        value
                                    }
                                }
                            }
                        };
                    }
                    return node;
                });
                return { ...state, nodes: nodesWithPropagatedValues };
            });

            // Save source node data and all connected target nodes' data
            await get().saveNodeData(nodeId);
            for (const conn of connections) {
                await get().saveNodeData(conn.targetId);
            }
        } else {
            // If no connections, just save the source node
            await get().saveNodeData(nodeId);
        }
    },
    getParam: (nodeId, paramName) => {
        const state = get();
        const node = state.nodes.find((n) => n.id === nodeId);
        if (!node?.data?.params) return null;
        console.log(`Getting param ${paramName} for node ${nodeId}:`, node.data.params[paramName]);
        return node.data.params[paramName];
    },
    setNodeExecuted: (id: string, cache: boolean, time: number, memory: number) => {
        set((state: NodeState) => {
            const updatedNodes = state.nodes.map(node => {
                if (node.id === id) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            cache,
                            time,
                            memory
                        }
                    };
                }
                return node;
            });
            return { ...state, nodes: updatedNodes };
        });
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
    initializeNodes: async () => {
        console.log('Running initializeNodes');
        const customComponents: CustomComponent[] = [
            {
                id: 'poms-simple-timeline',
                type: 'custom',
                position: { x: 100, y: 100 },
                data: {
                    module: 'custom_components',
                    action: 'PomsSimpleTimeline',
                    category: 'audio',
                    label: 'POM\'s Simple Timeline',
                    params: {
                        component: {
                            type: 'component',
                            display: 'component',
                            value: 'PomsSimpleTimeline',
                            label: 'POM\'s Simple Timeline'
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
                id: 'timestamp-display',
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
                id: 'timeline-images',
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

        // Get existing nodes to preserve their data
        const existingNodes = get().nodes;

        // Load persisted data for all nodes before adding them
        const nodesWithData = await Promise.all(customComponents.map(async (node) => {
            // Check if we have an existing node with this ID
            const existingNode = existingNodes.find(n => n.id === node.id);
            if (existingNode) {
                console.log('Preserving existing node data for:', node.id);
                return existingNode;
            }

            try {
                const nodeData = await dataService.loadNodeData(node.id);
                if (nodeData) {
                    const updatedParams = Object.fromEntries(
                        Object.entries(node.data.params).map(([key, param]) => {
                            const paramValue = nodeData.params[key];
                            return [
                                key,
                                {
                                    ...param,
                                    value: key === 'timestamps' && Array.isArray(paramValue) ? paramValue : 
                                           paramValue !== undefined ? paramValue : param.value ?? param.default
                                }
                            ];
                        })
                    ) as NodeData['params'];

                    const updatedData: NodeData = {
                        ...node.data,
                        params: updatedParams,
                        cache: nodeData.cache ?? false,
                        time: nodeData.time ?? 0,
                        memory: nodeData.memory ?? 0,
                        files: nodeData.files ?? []
                    };

                    return {
                        ...node,
                        data: updatedData
                    };
                }
            } catch (error) {
                console.error(`Error loading persisted data for node ${node.id}:`, error);
            }
            return node;
        }));

        // Add all nodes with their persisted data in a single update
        set((state: NodeState) => ({
            ...state,
            nodes: [...state.nodes, ...nodesWithData]
        }));
    },
    deleteNodeData: async (nodeId: string) => {
        await dataService.deleteNodeData(nodeId);
        set((state: NodeState) => {
            const updatedNodes = state.nodes.map(node => {
                if (node.id === nodeId) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            params: Object.fromEntries(
                                Object.entries(node.data.params).map(([key, param]) => [
                                    key,
                                    {
                                        ...param,
                                        value: param.default
                                    }
                                ])
                            ) as NodeData['params'],
                            cache: false,
                            time: 0,
                            memory: 0,
                            files: []  // Reset files array when deleting data
                        }
                    };
                }
                return node;
            });
            return { ...state, nodes: updatedNodes };
        });
    },
    loadNodeData: async (nodeId: string) => {
        const data = await dataService.loadNodeData(nodeId);
        if (data) {
            set((state: NodeState) => {
                const updatedNodes = state.nodes.map(node => {
                    if (node.id === nodeId) {
                        const updatedParams = Object.fromEntries(
                            Object.entries(node.data.params).map(([key, param]) => [
                                key,
                                {
                                    ...param,
                                    value: key === 'timestamps' && Array.isArray(data.params[key]) ? data.params[key] :
                                           data.params[key] !== undefined ? data.params[key] : param.value ?? param.default
                                }
                            ])
                        ) as NodeData['params'];

                        return {
                            ...node,
                            data: {
                                ...node.data,
                                params: updatedParams,
                                cache: data.cache ?? false,
                                time: data.time ?? 0,
                                memory: data.memory ?? 0,
                                files: data.files ?? []
                            }
                        };
                    }
                    return node;
                });
                return { ...state, nodes: updatedNodes };
            });
        }
    },
    saveNodeData: async (nodeId: string) => {
        const node = get().nodes.find(n => n.id === nodeId);
        if (node) {
            try {
                // Load existing data to preserve files field
                const existingData = await dataService.loadNodeData(nodeId);
                
                const data = {
                    params: Object.fromEntries(
                        Object.entries(node.data.params).map(([key, param]) => [
                            key,
                            param.value
                        ])
                    ),
                    files: existingData?.files ?? node.data.files ?? [],
                    cache: true,  // Always set cache to true when saving data
                    time: node.data.time ?? 0,
                    memory: node.data.memory ?? 0
                };
                
                await dataService.saveNodeData(nodeId, data);
                
                // Update the local node state to reflect the cache status
                set((state: NodeState) => ({
                    nodes: state.nodes.map(n => 
                        n.id === nodeId 
                            ? { ...n, data: { ...n.data, cache: true } }
                            : n
                    )
                }));
            } catch (error) {
                console.error(`Error saving data for node ${nodeId}:`, error);
            }
        }
    }
}));
