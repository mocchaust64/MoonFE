import { PublicKey, Transaction, TransactionInstruction, SystemProgram, SYSVAR_CLOCK_PUBKEY } from '@solana/web3.js';
import { Buffer } from 'buffer';
import BN from 'bn.js';
import { PROGRAM_ID } from '@/utils/constants';
import { createSecp256r1Instruction } from '@/utils/instructionUtils';
import { normalizeSignatureToLowS } from '@/lib/solana/secp256r1';
import { derToRaw } from '@/utils/bufferUtils';


// Interface cho các tham số chung
interface BaseTransferParams {
  multisigPubkey: PublicKey;
  payerPublicKey: PublicKey;
  guardianPubkey: PublicKey;
  guardianId: number;
  destinationPubkey: PublicKey;
  description: string;
  proposalId: BN;
  webauthnSignature: Uint8Array;
  authenticatorData: Uint8Array;
  clientDataJSON: Uint8Array;
  webAuthnPubKey: Buffer;
}

// Interface cho chuyển SOL
interface SolTransferParams extends BaseTransferParams {
  amountLamports: BN;
}

// Interface cho chuyển Token
interface TokenTransferParams extends BaseTransferParams {
  tokenMintPubkey: PublicKey;
  tokenAmount: BN;
}

// Hàm tạo và xử lý chữ ký WebAuthn
async function processWebAuthnSignature(params: {
  webauthnSignature: Uint8Array;
  authenticatorData: Uint8Array;
  clientDataJSON: Uint8Array;
  webAuthnPubKey: Buffer;
}): Promise<{
  verificationData: Buffer;
  normalizedSignature: Buffer;
}> {
  // 1. Tạo client data hash
  const clientDataHash = await crypto.subtle.digest('SHA-256', params.clientDataJSON);
  const clientDataHashBytes = new Uint8Array(clientDataHash);
  
  // 2. Tạo verification data
  const verificationData = new Uint8Array(params.authenticatorData.length + clientDataHashBytes.length);
  verificationData.set(new Uint8Array(params.authenticatorData), 0);
  verificationData.set(clientDataHashBytes, params.authenticatorData.length);
  
  // 3. Convert signature từ DER sang raw format
  const rawSignature = derToRaw(params.webauthnSignature);
  
  // 4. Chuẩn hóa signature về dạng Low-S
  const normalizedSignature = normalizeSignatureToLowS(Buffer.from(rawSignature));

  return {
    verificationData: Buffer.from(verificationData),
    normalizedSignature
  };
}

// Hàm tạo proposal cho chuyển SOL
export async function createSolTransferProposal(params: SolTransferParams): Promise<Transaction> {
  const tx = new Transaction();

  // Xử lý chữ ký WebAuthn
  const { verificationData, normalizedSignature } = await processWebAuthnSignature({
    webauthnSignature: params.webauthnSignature,
    authenticatorData: params.authenticatorData,
    clientDataJSON: params.clientDataJSON,
    webAuthnPubKey: params.webAuthnPubKey
  });

  // Thêm instruction xác thực WebAuthn
  tx.add(createSecp256r1Instruction(
    verificationData,
    params.webAuthnPubKey,
    normalizedSignature,
    false
  ));

  // Tạo data cho create_proposal
  const data = createProposalData({
    proposalId: params.proposalId,
    description: params.description,
    guardianId: params.guardianId,
    action: 'transfer',
    amount: params.amountLamports,
    destination: params.destinationPubkey,
  });

  // Thêm instruction tạo proposal
  tx.add(createProposalInstruction(params, data));

  return tx;
}

// Hàm tạo proposal cho chuyển Token
export async function createTokenTransferProposal(params: TokenTransferParams): Promise<Transaction> {
  // Kiểm tra tính hợp lệ của dữ liệu đầu vào
  if (!params.tokenMintPubkey) {
    throw new Error("Địa chỉ token mint không được để trống");
  }
  
  if (!params.tokenAmount || params.tokenAmount.isZero() || params.tokenAmount.isNeg()) {
    throw new Error("Số lượng token phải là số dương");
  }
  
  if (!params.destinationPubkey) {
    throw new Error("Địa chỉ đích không được để trống");
  }
  
  if (!params.description || params.description.trim() === '') {
    throw new Error("Mô tả đề xuất không được để trống");
  }
  
  try {
    // Kiểm tra xem địa chỉ token mint và destination có hợp lệ không
    params.tokenMintPubkey.toBase58();
    params.destinationPubkey.toBase58();
  } catch {
    throw new Error("Địa chỉ không hợp lệ, vui lòng kiểm tra lại");
  }

  const tx = new Transaction();

  // Xử lý chữ ký WebAuthn
  const { verificationData, normalizedSignature } = await processWebAuthnSignature({
    webauthnSignature: params.webauthnSignature,
    authenticatorData: params.authenticatorData,
    clientDataJSON: params.clientDataJSON,
    webAuthnPubKey: params.webAuthnPubKey
  });

  // Thêm instruction xác thực WebAuthn
  tx.add(createSecp256r1Instruction(
    verificationData,
    params.webAuthnPubKey,
    normalizedSignature,
    false
  ));

  // Tạo data cho create_proposal token transfer
  const data = createProposalData({
    proposalId: params.proposalId,
    description: params.description,
    guardianId: params.guardianId,
    action: 'transfer_token',
    tokenAmount: params.tokenAmount,
    destination: params.destinationPubkey,
    tokenMint: params.tokenMintPubkey
  });

  // Thêm instruction tạo proposal
  tx.add(createProposalInstruction(params, data));

  return tx;
}

// Hàm helper để tạo data cho proposal
function createProposalData(params: {
  proposalId: BN;
  description: string;
  guardianId: number;
  action: 'transfer' | 'transfer_token';
  amount?: BN;
  tokenAmount?: BN;
  destination: PublicKey;
  tokenMint?: PublicKey;
}): Buffer {
  const createProposalDiscriminator = [132, 116, 68, 174, 216, 160, 198, 22];
  
  const descriptionBuffer = Buffer.from(params.description);
  const descriptionLenBuffer = Buffer.alloc(4);
  descriptionLenBuffer.writeUInt32LE(descriptionBuffer.length, 0);
  
  // Sử dụng action string đúng như program yêu cầu (snake_case)
  const actionBuffer = Buffer.from(params.action);
  const actionLenBuffer = Buffer.alloc(4);
  actionLenBuffer.writeUInt32LE(actionBuffer.length, 0);

  const buffers = [
    Buffer.from(createProposalDiscriminator),
    Buffer.from(params.proposalId.toArrayLike(Buffer, 'le', 8)),
    Buffer.from(descriptionLenBuffer),
    descriptionBuffer,
    Buffer.from(new BN(params.guardianId).toArrayLike(Buffer, 'le', 8)),
    Buffer.from(actionLenBuffer),
    actionBuffer,
  ];

  // Thêm các trường tùy theo loại action
  if (params.action === 'transfer') {
    buffers.push(
      // amount (option<u64>): Some(amount)
      Buffer.from([1]),
      Buffer.from(params.amount!.toArrayLike(Buffer, 'le', 8)),
      // destination (option<publicKey>): Some(destination)
      Buffer.from([1]),
      Buffer.from(params.destination.toBuffer()),
      // token_mint (option<publicKey>): None
      Buffer.from([0]),
      // token_amount (option<u64>): None
      Buffer.from([0])
    );
  } else {
    buffers.push(
      // amount (option<u64>): None
      Buffer.from([0]),
      // destination (option<publicKey>): Some(destination)
      Buffer.from([1]),
      Buffer.from(params.destination.toBuffer()),
      // token_mint (option<publicKey>): Some(tokenMint)
      Buffer.from([1]),
      Buffer.from(params.tokenMint!.toBuffer()),
      // token_amount (option<u64>): Some(tokenAmount)
      Buffer.from([1]),
      Buffer.from(params.tokenAmount!.toArrayLike(Buffer, 'le', 8))
    );
  }

  return Buffer.concat(buffers);
}

// Hàm helper để tạo instruction cho proposal
function createProposalInstruction(
  params: BaseTransferParams,
  data: Buffer
): TransactionInstruction {
  const [proposalPubkey] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('proposal'),
      params.multisigPubkey.toBuffer(),
      params.proposalId.toArrayLike(Buffer, 'le', 8),
    ],
    PROGRAM_ID
  );

  return new TransactionInstruction({
    keys: [
      { pubkey: params.multisigPubkey, isSigner: false, isWritable: true },
      { pubkey: proposalPubkey, isSigner: false, isWritable: true },
      { pubkey: params.guardianPubkey, isSigner: false, isWritable: false },
      { pubkey: params.payerPublicKey, isSigner: true, isWritable: true },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });
} 