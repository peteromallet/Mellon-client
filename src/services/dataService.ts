import config from '../../config';

export interface NodePersistentData {
    params: { [key: string]: any };
    files?: string[];
    cache?: boolean;
    time?: number;
    memory?: number;
}

class DataService {
    private baseUrl: string;
    private readonly FILES_BASE_PATH = '';

    constructor() {
        this.baseUrl = `http://${config.serverAddress}`;
    }

    getFullFilePath(fileName: string): string {
        const baseFileName = fileName.includes('/') ? fileName.split('/').pop()! : fileName;
        return baseFileName;
    }

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
        const baseFileName = fileName.includes('/') ? fileName.split('/').pop()! : fileName;
        formData.append('file', new Blob([fileData]), baseFileName);

        const response = await fetch(`${this.baseUrl}/data/files`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Failed to save node file: ${response.statusText}`);
        }

        return baseFileName;
    }

    async loadNodeFile(nodeName: string, fileName: string): Promise<ArrayBuffer | null> {
        try {
            const baseFileName = fileName.includes('/') ? fileName.split('/').pop()! : fileName;
            const response = await fetch(`${this.baseUrl}/data/files/${baseFileName}`);
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

    async deleteNodeFile(nodeName: string, fileName: string): Promise<void> {
        const baseFileName = fileName.includes('/') ? fileName.split('/').pop()! : fileName;
        const response = await fetch(`${this.baseUrl}/data/files/${baseFileName}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error(`Failed to delete node file: ${response.statusText}`);
        }
    }
}

// Create and export a singleton instance
export const dataService = new DataService();
export default dataService; 