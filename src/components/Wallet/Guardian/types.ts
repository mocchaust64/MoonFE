import { Timestamp } from "firebase/firestore";

export interface GuardianData {
  inviteCode: string;
  guardianId: number;
  multisigAddress: string;
  guardianName: string;
  hashedRecoveryBytes: number[];
  webauthnCredentialId: string;
  webauthnPublicKey: number[];
  status: "pending" | "ready" | "completed";
  createdAt?: Timestamp;
  completedAt?: Timestamp;
  txSignature?: string; // Chữ ký giao dịch khi hoàn tất
}

export interface InviteData {
  inviteCode: string;
  multisigAddress: string;
  guardianId: number;
  ownerId: string;
  status: "pending" | "ready" | "completed";
  createdAt: Timestamp;
}

export interface GuardianConfirmProps {
  inviteCode: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export interface GuardianSignupProps {
  inviteCode: string;
  onComplete?: () => void;
}
