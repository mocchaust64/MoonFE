import { Program, BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  Transaction,
  Keypair,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  Connection,
  TransactionInstruction,
} from "@solana/web3.js";
import { PROGRAM_ID } from "./index";

// Types
export interface InitializeMultisigParams {
  threshold: number;
  credentialId: string;
}

export interface AddGuardianParams {
  guardianId: number;
  guardianName: string;
  recoveryHashIntermediate: Uint8Array;
  isOwner: boolean;
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
      .initializeMultisig(params.threshold, params.credentialId)
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
        params.guardianName,
        params.recoveryHashIntermediate,
        params.isOwner,
        params.webauthnPubkey,
      )
      .accounts({
        multisig: multisigPubkey,
        guardian: guardianPDA,
        guardian_pubkey: guardianPublicKey,
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
 * Các hàm tiện ích cho phương pháp thủ công
 */
// Nối nhiều Uint8Array thành một
function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// Chuyển đổi Buffer thành Uint8Array
function bufferToUint8Array(buffer: Buffer): Uint8Array {
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.length);
}

// Chuyển BigInt thành mảng little-endian bytes
function bigIntToLeBytes(value: bigint, bytesLength: number = 8): Uint8Array {
  const result = new Uint8Array(bytesLength);
  for (let i = 0; i < bytesLength; i++) {
    result[i] = Number((value >> BigInt(8 * i)) & BigInt(0xff));
  }
  return result;
}

/**
 * Interface cho tham số hàm tạo transaction thêm guardian
 */
export interface AddGuardianTxManualParams {
  multisigPDA: PublicKey;
  guardianPDA: PublicKey;
  feePayer: PublicKey;
  guardianName: string;
  guardianId: number;
  recoveryHashIntermediate: Uint8Array;
  webauthnPubkey?: Uint8Array;
  isOwner?: boolean;
}

/**
 * Tạo transaction thêm guardian theo phương pháp thủ công
 * Cách này phù hợp với cấu trúc dữ liệu instruction của Solana program
 */
export const createAddGuardianTxManual = (
  params: AddGuardianTxManualParams
): Transaction => {
  try {
    // Đặt giá trị mặc định cho tham số isOwner nếu không được cung cấp
    const isOwner = params.isOwner ?? true;
    
    // Discriminator cho add_guardian
    const addGuardianDiscriminator = new Uint8Array([167, 189, 170, 27, 74, 240, 201, 241]);
    
    // Chuyển guardian ID thành bytes
    const guardianIdBigInt = BigInt(params.guardianId);
    const guardianIdBytes = bigIntToLeBytes(guardianIdBigInt);
    
    // Chuẩn bị tên guardian
    const guardianNameBuffer = Buffer.from(params.guardianName);
    const guardianNameLenBuffer = Buffer.alloc(4);
    guardianNameLenBuffer.writeUInt32LE(guardianNameBuffer.length, 0);
    
    // Đặt is_owner theo tham số đầu vào
    const isOwnerByte = new Uint8Array([isOwner ? 1 : 0]); // true = 1, false = 0
    
    // Tạo dữ liệu instruction
    const buffers = [
      addGuardianDiscriminator,
      bufferToUint8Array(Buffer.from(guardianIdBytes)),
      bufferToUint8Array(guardianNameLenBuffer),
      bufferToUint8Array(guardianNameBuffer),
      params.recoveryHashIntermediate,
      isOwnerByte,
    ];
    
    // Thêm webauthnPubkey nếu có
    if (params.webauthnPubkey) {
      buffers.push(new Uint8Array([1])); // Some variant
      buffers.push(params.webauthnPubkey);
    } else {
      buffers.push(new Uint8Array([0])); // None variant
    }
    
    const data = concatUint8Arrays(...buffers);
    
    // Tạo transaction add guardian
    const tx = new Transaction();
    tx.add(
      new TransactionInstruction({
        keys: [
          { pubkey: params.multisigPDA, isSigner: false, isWritable: true },
          { pubkey: params.guardianPDA, isSigner: false, isWritable: true },
          { pubkey: params.feePayer, isSigner: false, isWritable: false },
          { pubkey: params.feePayer, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
        ],
        programId: PROGRAM_ID,
        data: Buffer.from(data)
      })
    );
    
    return tx;
  } catch (error) {
    console.error("Lỗi khi tạo transaction add guardian:", error);
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
  const nonceBytes = accountInfo.data.subarray(nonceOffset, nonceOffset + 8);
  const currentNonce = new BN(nonceBytes, 'le');
  
  return currentNonce.toNumber();
};


