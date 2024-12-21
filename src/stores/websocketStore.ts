import { createWithEqualityFn } from 'zustand/traditional';
import { useNodeState } from './nodeStore';
import { nanoid } from 'nanoid';
/*
const selectNodeState = (state: NodeState) => ({
    nodes: state.nodes,
    setParamValue: state.setParamValue,
});
*/
export type WebsocketState = {
    address: string | null;
    sid: string | null;
    socket: WebSocket | null;
    isConnected: boolean;
    reconnectTimer: NodeJS.Timeout | undefined;

    connect: (addr?: string) => void;
    disconnect: () => void;

    modelData: Record<string, string>;
    updateModelData: (nodeId: string, key: string, value: string) => void;
}

export const useWebsocketState = createWithEqualityFn<WebsocketState>((set, get) => ({
    address: null,
    sid: null,
    socket: null,
    isConnected: false,
    reconnectTimer: undefined,

    modelData: {},

    updateModelData: (nodeId: string, key: string, value: string) => {
        set((state) => ({
            modelData: {
                ...state.modelData,
                [`${nodeId}-${key}`]: value
            }
        }));
    },

    connect: async (addr?: string) => {
        const { reconnectTimer } = get();
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            set({ reconnectTimer: undefined });
        }
    
        let { address, sid, socket } = get();
        console.log('connect', address, sid, socket);

        if (socket) {
            console.info('WebSocket already created.');
            return;
        }

        if (!address && !addr) {
            console.error('Cannot connect to WebSocket. No address specified.');
            return;
        }

        if (addr && addr !== address) {
            address = addr;
            set({ address });
        }

        if (!sid) {
            sid = nanoid(10);
            set({ sid });
        }

        socket = new WebSocket(`${address}?sid=${sid}`);
        set({ socket });

        const onOpen = () => {
            set({ isConnected: true, reconnectTimer: undefined });
            console.info('WebSocket connection established');
        };

        const onClose = () => {
            clearTimeout(get().reconnectTimer); // just to be sure
            set({ socket: null, isConnected: false, reconnectTimer: undefined });
            console.info('WebSocket connection closed');

            const timer = setTimeout(() => {
                console.info('Trying to reconnect...');
                get().connect();
            }, 500);

            set({ reconnectTimer: timer });
        };

        const onMessage = (event: MessageEvent) => {
            //const { setNodeExecuted } = useNodeState((state: NodeState) => ({ setNodeExecuted: state.setNodeExecuted }), shallow);
            const message = JSON.parse(event.data);

            if (message.type === 'welcome') {
                if (!message.sid) {
                    console.error('Invalid welcome message.');
                    return;
                }
                if (message.sid !== sid) {
                    console.info('Session ID mismatch. Updating.', message.sid, sid);
                    set({ sid: message.sid });
                }
                console.info('WebSocket connection established');
            }
            else if (message.type === 'image') {
                if (!message.data || !message.nodeId || !message.key) {
                    console.error('Invalid image message. Ignoring.');
                    return;
                }
                //setParamValue(message.nodeId, message.key, message.data);
                const el = document.getElementById(message.nodeId)?.querySelector(`[data-key="${message.key}"]`);
                if (el) {
                    el.setAttribute('src', `data:image/png;base64,${message.data}`);
                }
            }
            else if (message.type === '3d') {
                if (!message.data || !message.nodeId || !message.key) {
                    console.error('Invalid 3D model message. Ignoring.');
                    return;
                }
                const dataUrl = `data:model/gltf-binary;base64,${message.data}`;
                get().updateModelData(message.nodeId, message.key, dataUrl);
                    
                // For blob data
                // const blob = new Blob([message.data], { type: 'model/gltf-binary' });
                // const url = URL.createObjectURL(blob);
                // el.setAttribute('url', url);
            }
            else if (message.type === 'executed') {
                console.log('executed', message);
                if (!message.nodeId) {
                    console.error('Invalid executed message. Ignoring.');
                    return;
                }
                useNodeState.getState().setNodeExecuted(message.nodeId, true, message.time || 0, message.memory || 0);

                if ('updateValues' in message) {
                    Object.entries(message.updateValues).forEach(([k, v]) => {
                        useNodeState.getState().setParamValue(message.nodeId, k, v);
                    });
                }
            }
        };

        //const onError = (event: Event) => {
        //    console.error('WebSocket error:', event);
        //};

        socket.addEventListener('open', onOpen);
        socket.addEventListener('close', onClose);
        socket.addEventListener('message', onMessage);
        //socket.addEventListener('error', onError);
    },
    disconnect: async () => {
        const { reconnectTimer } = get();
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
        }
        set((state) => {
            if (state.socket) {
                state.socket.close();
            }
            return ({
                socket: null,
                isConnected: false,
                reconnectTimer: undefined,
            });
        });
    },
    destroy: async () => {
        get().disconnect();
        set({ address: null, sid: null });
    },
}))
