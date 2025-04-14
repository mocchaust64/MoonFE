import { PublicKey, Transaction } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  TimeStamped,
  BaseError,
  ValidationResult,
  PaginatedState,
} from "./common";

export interface TransactionState extends PaginatedState<Transaction> {
  pendingTransactions: Transaction[];
}

export interface TransactionParams {
  from: PublicKey;
  to: PublicKey;
  amount: number;
  memo?: string;
}

export interface TransactionSignature {
  signature: string;
  blockhash: string;
  lastValidBlockHeight: number;
}

export interface TransactionStatus extends TimeStamped {
  status: "pending" | "confirmed" | "failed";
  signature: string;
  error?: string;
}

export interface TransactionError extends BaseError {
  code: TransactionErrorCode;
  signature?: string;
}

export enum TransactionErrorCode {
  INVALID_TRANSACTION = "INVALID_TRANSACTION",
  INSUFFICIENT_FUNDS = "INSUFFICIENT_FUNDS",
  INVALID_SIGNATURE = "INVALID_SIGNATURE",
  TRANSACTION_FAILED = "TRANSACTION_FAILED",
  TIMEOUT = "TIMEOUT",
}

export enum TransactionType {
  TRANSFER = "TRANSFER",
  CREATE_WALLET = "CREATE_WALLET",
  ADD_GUARDIAN = "ADD_GUARDIAN",
  REMOVE_GUARDIAN = "REMOVE_GUARDIAN",
  UPDATE_THRESHOLD = "UPDATE_THRESHOLD",
}

export interface TransactionMetadata extends TimeStamped {
  type: TransactionType;
  description: string;
  signers: PublicKey[];
  requiredSignatures: number;
}

export interface TransactionValidationResult extends ValidationResult {
  transaction?: Transaction;
  metadata?: TransactionMetadata;
}

export interface ActionParams {
  amount: BN | null;
  destination: PublicKey | null;
  tokenMint: PublicKey | null;
}

// Hàm tạo ActionParams
export const createActionParams = (
  amount?: BN | number,
  destination?: PublicKey | string,
  tokenMint?: PublicKey | string
): ActionParams => {
  return {
    amount: amount ? (typeof amount === 'number' ? new BN(amount) : amount) : null,
    destination: destination 
      ? (typeof destination === 'string' ? new PublicKey(destination) : destination) 
      : null,
    tokenMint: tokenMint 
      ? (typeof tokenMint === 'string' ? new PublicKey(tokenMint) : tokenMint) 
      : null,
  };
};
