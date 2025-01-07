import { createWithEqualityFn } from 'zustand/traditional';
import config from '../../config';
import { customNodes } from '../nodeRegistry';

type NodeType = {
    [key: string]: {
        label: string
        module: string
        action: string
        category: string
        type?: string
        params?: { [key: string]: any }
        output?: { [key: string]: any }
        ui?: { [key: string]: any }
    }
}

export type NodeRegistryState = {
    nodeRegistry: NodeType;
    updateNodeRegistry: () => Promise<void>;
}

export const useNodeRegistryState = createWithEqualityFn<NodeRegistryState>((set) => ({
    nodeRegistry: customNodes,
    updateNodeRegistry: async () => {
        try {
            const response = await fetch('http://' + config.serverAddress + '/nodes')
            const data = await response.json()
            set({ nodeRegistry: { ...data, ...customNodes } })
        } catch (error) {
            console.error('Can\'t connect to route `/nodes`', error)
            // Still set the custom nodes even if server is not available
            set({ nodeRegistry: customNodes })
        }
    },
}))