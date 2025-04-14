import { Program, BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  Transaction,
  Keypair,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  Connection,
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

export interface TransferParams {
  destination: PublicKey;
  amount: number;
  nonce: number;
  timestamp: number;
  message: Uint8Array;
}

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


export const createTransferTx = async (
  program: Program,
  params: TransferParams,
  multisigPDA: PublicKey,
  guardianPDA: PublicKey,
  payer: PublicKey,
): Promise<Transaction> => {
  try {
    // Validate input
    if (params.amount <= 0) {
      throw new Error(`Amount must be positive: ${params.amount}`);
    }

    // Create ActionParams struct
    const actionParams = {
      amount: new BN(params.amount),
      destination: params.destination,
      tokenMint: null // None variant for token_mint
    };

    // Use Anchor program methods
    return await program.methods
      .verifyAndExecute(
        "transfer", // action
        actionParams, // params
        new BN(params.nonce), // nonce
        new BN(params.timestamp), // timestamp
        params.message // message
      )
      .accounts({
        multisig: multisigPDA,
        guardian: guardianPDA,
        clock: SYSVAR_CLOCK_PUBKEY,
        instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        systemProgram: SystemProgram.programId,
        payer: payer,
        destination: params.destination,
      })
      .transaction();

  } catch (error) {
    console.error("Error creating transfer transaction:", error);
    throw error;
  }
};

/**
 * Đọc nonce hiện tại của multisig wallet từ blockchain
 */
export const readMultisigNonce = async (
  connection: Connection,
  multisigPDA: PublicKey
): Promise<number> => {
  const accountInfo = await connection.getAccountInfo(multisigPDA);
  if (!accountInfo) {
    throw new Error(`Không tìm thấy tài khoản multisig: ${multisigPDA.toString()}`);
  }

  // Offset của transaction_nonce
  // 8 bytes (discriminator) + 1 byte (threshold) + 1 byte (guardian_count) + 8 bytes (recovery_nonce) + 1 byte (bump) = 19
  const nonceOffset = 19;
  
  // Đọc 8 bytes của transaction_nonce
  const nonceBytes = accountInfo.data.slice(nonceOffset, nonceOffset + 8);
  const currentNonce = new BN(nonceBytes, 'le');
  
  return currentNonce.toNumber();
};


