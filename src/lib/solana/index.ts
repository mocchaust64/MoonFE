import { Program, AnchorProvider, Idl, Wallet } from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  Commitment,
  Transaction,
} from "@solana/web3.js";

import IDL from "../../../idl.json";
import { createFeePayerKeypair } from "./keypairs";

// Constants
const RPC_ENDPOINT = "https://api.devnet.solana.com";

// Connection Configuration
const connectionOptions = {
  commitment: "confirmed" as Commitment,
  confirmTransactionInitialTimeout: 30000,
  disableRetryOnRateLimit: false,
  useWebSocket: true,
  skipPreflight: true,
};


// Solana Connection
export const connection = new Connection(RPC_ENDPOINT, connectionOptions);

// Create default feePayer
const feePayer = createFeePayerKeypair();

// Create wallet adapter from keypair
const walletAdapter = {
  publicKey: feePayer.publicKey,
  signTransaction: async (tx: Transaction) => {
    tx.partialSign(feePayer);
    return tx;
  },
  signAllTransactions: async (txs: Transaction[]) => {
    return txs.map((tx) => {
      tx.partialSign(feePayer);
      return tx;
    });
  },
} as Wallet;

// Create provider with wallet adapter
const provider = new AnchorProvider(
  connection,
  walletAdapter,
  connectionOptions,
);

// ProgramID from IDL
export const PROGRAM_ID = new PublicKey(IDL.address);
export const program = new Program<Idl>(IDL as Idl, provider);

export type MoonWalletProgram = typeof program;
export type { Idl };
