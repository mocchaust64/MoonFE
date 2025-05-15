declare module '@lazorkit/wallet' {
  import { Connection } from '@solana/web3.js';

  export interface WalletHook {
    isConnected: boolean;
    publicKey: string | null;
    connect: () => Promise<void>;
    disconnect: () => void;
    signMessage: (message: Uint8Array) => Promise<Uint8Array>;
    error: string | null;
  }

  export function useWallet(connection: Connection): WalletHook;

  export interface LazorConnectProps {
    connection: Connection;
    onConnect?: (publicKey: string) => void;
    [key: string]: any;
  }

  export function LazorConnect(props: LazorConnectProps): JSX.Element;
} 