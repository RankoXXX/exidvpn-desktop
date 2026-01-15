declare class VPNManager {
    constructor(options?: {
        binaryDir?: string;
        adapterName?: string;
        protocolTag?: string;
        tempDir?: string;
    });

    setStatusCallback(callback: (status: string) => void): void;
    getStatus(): string;
    connect(credentials: { protocol: string; payload: string; uid: string }): Promise<boolean>;
    disconnect(): Promise<boolean>;
    cleanup(): Promise<void>;
}

declare const STATUSES: {
    DISCONNECTED: 'disconnected';
    CONNECTED: 'connected';
    CONNECTING: 'connecting';
    DISCONNECTING: 'disconnecting';
};

export default VPNManager;
export { STATUSES };
