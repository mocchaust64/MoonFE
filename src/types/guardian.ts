/**
 * Guardian types for Firebase and components
 */
import { Timestamp } from "firebase/firestore";

// Status type for both invitations and guardians
export type GuardianStatus = "pending" | "ready" | "completed";

// Basic invitation structure
export interface InviteData {
  inviteCode: string; // Unique invitation code
  multisigPDA: string; // Multisig wallet address
  guardianId: number; // Guardian ID (1-8)
  status: GuardianStatus; // Current status
  createdAt: Date | Timestamp;
  walletName: string; // Name of the wallet
  threshold?: number; // Số lượng guardian cần thiết để recovery
}

// Guardian data structure
export interface GuardianData {
  inviteCode: string; // Links to invitation
  guardianId: number; // Guardian ID (1-8)
  multisigPDA: string; // Multisig wallet address
  hashedRecoveryBytes: number[]; // Hashed recovery phrase
  webauthnCredentialId: string; // WebAuthn credential ID
  webauthnPublicKey: number[]; // Compressed public key (33 bytes)
  status: GuardianStatus; // Current status
  guardianName?: string; // Guardian name
  createdAt: Date | Timestamp;
  completedAt?: Date | Timestamp;
  txSignature?: string; // Transaction signature after completion
  isOwner?: boolean; // Guardian có quyền owner hay không (mặc định là true)
}

// WebAuthn credential mapping
export interface WebAuthnMapping {
  credentialId: string; // WebAuthn credential ID
  walletAddress: string; // Multisig wallet address
  publicKey: number[]; // Compressed public key (33 bytes)
  guardianId: number; // Guardian ID (1-8)
  guardianName?: string; // Tên của guardian
  threshold?: number; // Ngưỡng ký của multisig
}

// Component Props Types
export interface GuardianCardProps {
  guardian: GuardianData;
  onRemove?: (guardian: GuardianData) => void;
}

export interface Guardian {
  id: number;
  publicKey: string;
  isConfirmed: boolean;
}
