import { Program, BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  Transaction,
  Keypair,
  SystemProgram,
} from "@solana/web3.js";

// Types
export interface InitializeMultisigParams {
  threshold: number;
  credentialId: string;
  name: string;
}

export interface AddGuardianParams {
  guardianId: number;
  recoveryHashIntermediate: Uint8Array;
  webauthnPubkey?: Uint8Array;
}

/**
 * Tạo transaction khởi tạo multisig wallet
 */
export const createInitializeMultisigTx = async (
  program: Program,
  params: InitializeMultisigParams,
  multisigPDA: PublicKey,
  feePayer: Keypair,
): Promise<Transaction> => {
  try {
    return await program.methods
      .initializeMultisig(params.threshold, params.credentialId, params.name)
      .accounts({
        multisig: multisigPDA,
        feePayer: feePayer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .transaction();
  } catch (error) {
    console.error("Error creating initialize multisig transaction:", error);
    throw error;
  }
};

/**
 * Tạo transaction thêm guardian
 */
export const createAddGuardianTx = async (
  program: Program,
  params: AddGuardianParams,
  multisigPubkey: PublicKey,
  guardianPDA: PublicKey,
  guardianPublicKey: PublicKey,
  feePayer: PublicKey,
): Promise<Transaction> => {
  try {
    return await program.methods
      .addGuardian(
        new BN(params.guardianId),
        params.recoveryHashIntermediate,
        params.webauthnPubkey,
      )
      .accounts({
        multisig: multisigPubkey,
        guardian: guardianPDA,
        guardianPubkey: guardianPublicKey,
        payer: feePayer,
        systemProgram: SystemProgram.programId,
      })
      .transaction();
  } catch (error) {
    console.error("Error creating add guardian transaction:", error);
    throw error;
  }
};

/**
 * Tạo transaction xóa guardian
 */
export const createRemoveGuardianTx = async (
  program: Program,
  guardianId: number,
  ownerGuardianId: number,
  multisigPDA: PublicKey,
  guardianPDA: PublicKey,
  feePayer: PublicKey,
): Promise<Transaction> => {
  try {
    return await program.methods
      .removeGuardian(guardianId, ownerGuardianId)
      .accounts({
        multisig: multisigPDA,
        guardian: guardianPDA,
        payer: feePayer,
        systemProgram: SystemProgram.programId,
      })
      .transaction();
  } catch (error) {
    console.error("Error creating remove guardian transaction:", error);
    throw error;
  }
};

/**
 * Tạo transaction cập nhật trạng thái guardian
 */
export const createUpdateGuardianStatusTx = async (
  program: Program,
  guardianId: number,
  ownerGuardianId: number,
  isActive: boolean,
  multisigPDA: PublicKey,
  guardianPDA: PublicKey,
  feePayer: PublicKey,
): Promise<Transaction> => {
  try {
    return await program.methods
      .updateGuardianStatus(guardianId, ownerGuardianId, isActive)
      .accounts({
        multisig: multisigPDA,
        guardian: guardianPDA,
        payer: feePayer,
      })
      .transaction();
  } catch (error) {
    console.error("Error creating update guardian status transaction:", error);
    throw error;
  }
};
