import { PublicKey } from "@solana/web3.js";

import { TimeStamped, BaseError, ValidationResult } from "./common";

export interface Wallet extends TimeStamped {
  name: string;
  description?: string;
  multisigAddress: PublicKey;
  guardianPDA: PublicKey;
  threshold: number;
}

export interface Guardian extends TimeStamped {
  id: bigint;
  name: string;
  publicKey: PublicKey;
  isOwner: boolean;
  isActive: boolean;
}

export interface WalletState {
  isLoggedIn: boolean;
  currentWallet: Wallet | null;
  guardians: Guardian[];
  balance: number;
  isLoading: boolean;
  error: string | null;
}

export interface CreateWalletParams {
  name: string;
  description?: string;
  threshold?: number;
}

export interface LoginWalletParams {
  walletAddress: string;
  credentials: {
    id: string;
    type: string;
    rawId: ArrayBuffer;
    response: {
      clientDataJSON: ArrayBuffer;
      attestationObject: ArrayBuffer;
    };
  };
}

export interface WalletError extends BaseError {
  code: WalletErrorCode;
}

export enum WalletErrorCode {
  WALLET_NOT_FOUND = "WALLET_NOT_FOUND",
  INVALID_WALLET_ADDRESS = "INVALID_WALLET_ADDRESS",
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  INVALID_THRESHOLD = "INVALID_THRESHOLD",
}

export interface WalletValidationResult extends ValidationResult {
  wallet?: Wallet;
}
