import config from '../../config';

export interface NodePersistentData {
    params: { [key: string]: any };
    files?: string[];
    cache?: boolean;
    time?: number;
    memory?: number;
}

class DataService {
    private baseUrl = `http://${config.serverAddress}`;

    async saveNodeData(nodeName: string, data: NodePersistentData): Promise<void> {
        const response = await fetch(`${this.baseUrl}/node/${nodeName}/data`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error(`Failed to save node data: ${response.statusText}`);
        }
    }

    async loadNodeData(nodeName: string): Promise<NodePersistentData | null> {
        try {
            const response = await fetch(`${this.baseUrl}/node/${nodeName}/data`);
            if (response.ok) {
                return await response.json();
            }
            if (response.status === 404) {
                return null;
            }
            throw new Error(`Failed to load node data: ${response.statusText}`);
        } catch (error) {
            console.error(`Error loading data for node ${nodeName}:`, error);
            return null;
        }
    }

    async deleteNodeData(nodeName: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/node/${nodeName}/data`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error(`Failed to delete node data: ${response.statusText}`);
        }
    }

    async saveNodeFile(nodeName: string, fileName: string, fileData: ArrayBuffer): Promise<string> {
        const formData = new FormData();
        formData.append('file', new Blob([fileData]), fileName);

        const response = await fetch(`${this.baseUrl}/node/${nodeName}/file`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Failed to save node file: ${response.statusText}`);
        }

        return fileName;
    }

    async loadNodeFile(nodeName: string, fileName: string): Promise<ArrayBuffer | null> {
        try {
            const response = await fetch(`${this.baseUrl}/node/${nodeName}/file/${fileName}`);
            if (response.ok) {
                return await response.arrayBuffer();
            }
            if (response.status === 404) {
                return null;
            }
            throw new Error(`Failed to load node file: ${response.statusText}`);
        } catch (error) {
            console.error(`Error loading file ${fileName} for node ${nodeName}:`, error);
            return null;
        }
    }
}

export const dataService = new DataService(); 