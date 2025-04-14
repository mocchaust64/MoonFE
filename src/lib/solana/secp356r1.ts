import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { Buffer } from "buffer";
import BN from 'bn.js';

// Hằng số cho chương trình secp256r1
export const SECP256R1_PROGRAM_ID = new PublicKey(
  "Secp256r1SigVerify1111111111111111111111111"
);

// Các hằng số cho Secp256r1
export const COMPRESSED_PUBKEY_SIZE = 33;
export const SIGNATURE_SIZE = 64;
export const DATA_START = 16; // 2 bytes header + 14 bytes offsets
export const SIGNATURE_OFFSETS_START = 2;
const SECP256R1_ORDER = new BN('FFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551', 16);
const SECP256R1_HALF_ORDER = SECP256R1_ORDER.shrn(1);


/**
 * Chuẩn hóa chữ ký về dạng Low-S
 * @param signature - Chữ ký raw
 * @returns Chữ ký đã chuẩn hóa
 */
export const normalizeSignatureToLowS = (sig: Buffer): Buffer => {
  const r = sig.slice(0, 32);
  const s = sig.slice(32, 64);
  
  const sBN = new BN(s);
  console.log("S value (BN):", sBN.toString(16));
  console.log("HALF_ORDER:", SECP256R1_HALF_ORDER.toString(16));
  
  // Kiểm tra nếu s > half_order
  if (sBN.gt(SECP256R1_HALF_ORDER)) {
    console.log("Chuẩn hóa signature về dạng Low-S");
    // Tính s' = order - s
    const sNormalized = SECP256R1_ORDER.sub(sBN);
    console.log("S normalized:", sNormalized.toString(16));
    const sNormalizedBuffer = sNormalized.toArrayLike(Buffer, 'be', 32);
    return Buffer.concat([r, sNormalizedBuffer]);
  }
  
  console.log("Signature đã ở dạng Low-S");
  return sig;
};

/**
 * Tạo instruction data cho chương trình Secp256r1SigVerify
 * @param message Tin nhắn gốc không hash
 * @param publicKey Khóa công khai nén
 * @param signature Chữ ký chuẩn hóa
 */
export const createSecp256r1Instruction = (
  message: Buffer,
  publicKey: Buffer,
  signature: Buffer,
  shouldFlipPublicKey: boolean = false
): TransactionInstruction => {
  console.log("Tạo secp256r1 instruction với:", {
    messageLength: message.length,
    pubkeyLength: publicKey.length,
    signatureLength: signature.length
  });

  // Tính tổng kích thước dữ liệu
  const totalSize = DATA_START + SIGNATURE_SIZE + COMPRESSED_PUBKEY_SIZE + message.length;
  const instructionData = Buffer.alloc(totalSize);

  // Ghi số lượng chữ ký và padding
  instructionData.writeUInt8(1, 0); // num_signatures = 1
  instructionData.writeUInt8(0, 1); // padding

  // Tính offset
  const signatureOffset = DATA_START;
  const publicKeyOffset = signatureOffset + SIGNATURE_SIZE;
  const messageDataOffset = publicKeyOffset + COMPRESSED_PUBKEY_SIZE;

  // Ghi offsets
  let offset = SIGNATURE_OFFSETS_START;
  instructionData.writeUInt16LE(signatureOffset, offset);
  instructionData.writeUInt16LE(0xffff, offset + 2);
  offset += 4;

  instructionData.writeUInt16LE(publicKeyOffset, offset);
  instructionData.writeUInt16LE(0xffff, offset + 2);
  offset += 4;

  instructionData.writeUInt16LE(messageDataOffset, offset);
  instructionData.writeUInt16LE(message.length, offset + 2);
  instructionData.writeUInt16LE(0xffff, offset + 4);

  // Copy dữ liệu
  signature.copy(instructionData, signatureOffset);

  // Xử lý public key
  if (shouldFlipPublicKey) {
    const flippedKey = Buffer.from(publicKey);
    flippedKey[0] = flippedKey[0] === 0x02 ? 0x03 : 0x02;
    flippedKey.copy(instructionData, publicKeyOffset);
  } else {
    publicKey.copy(instructionData, publicKeyOffset);
  }

  message.copy(instructionData, messageDataOffset);

  console.log("Instruction data:", {
    totalSize,
    signatureOffset,
    publicKeyOffset,
    messageDataOffset,
    messageLength: message.length
  });

  return new TransactionInstruction({
    keys: [],
    programId: SECP256R1_PROGRAM_ID,
    data: instructionData,
  });
};

