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
const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_RPC_ENDPOINT || "https://api.devnet.solana.com";
export const PROGRAM_ID = new PublicKey(IDL.address);

// Connection Configuration
const connectionOptions = {
  commitment: "confirmed" as Commitment,
  confirmTransactionInitialTimeout: 60000,
  disableRetryOnRateLimit: false,
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
export const program = new Program(IDL as Idl, provider);

// Re-export program types
export type MoonWalletProgram = Program<Idl>;
export type { Idl };
