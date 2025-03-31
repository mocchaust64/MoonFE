import { PublicKey } from "@solana/web3.js";

export interface GuardianState {
  guardians: Guardian[];
  isLoading: boolean;
  error: string | null;
}

export interface Guardian {
  id: bigint;
  name: string;
  publicKey: PublicKey;
  isOwner: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddGuardianParams {
  walletAddress: PublicKey;
  guardianName: string;
  guardianPublicKey: PublicKey;
  isOwner: boolean;
  recoveryPhrase: string;
}

export interface RemoveGuardianParams {
  walletAddress: PublicKey;
  guardianId: bigint;
  guardianPublicKey: PublicKey;
}

export interface UpdateGuardianParams {
  walletAddress: PublicKey;
  guardianId: bigint;
  name?: string;
  isActive?: boolean;
}

export interface GuardianError extends Error {
  code: GuardianErrorCode;
  details?: unknown;
}

export enum GuardianErrorCode {
  GUARDIAN_NOT_FOUND = "GUARDIAN_NOT_FOUND",
  GUARDIAN_ALREADY_EXISTS = "GUARDIAN_ALREADY_EXISTS",
  INVALID_GUARDIAN_PUBLIC_KEY = "INVALID_GUARDIAN_PUBLIC_KEY",
  CANNOT_REMOVE_OWNER = "CANNOT_REMOVE_OWNER",
  INSUFFICIENT_SIGNATURES = "INSUFFICIENT_SIGNATURES",
  INVALID_RECOVERY_PHRASE = "INVALID_RECOVERY_PHRASE",
}

export interface GuardianValidationResult {
  isValid: boolean;
  errors: GuardianError[];
}
