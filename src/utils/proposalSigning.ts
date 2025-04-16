import { PublicKey, Transaction, TransactionInstruction, Connection, SystemProgram, SYSVAR_INSTRUCTIONS_PUBKEY, SYSVAR_CLOCK_PUBKEY } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { sha256 } from '@noble/hashes/sha256';
import { getWalletByCredentialId } from '@/lib/firebase/webAuthnService';
import { getGuardianPDA } from './credentialUtils';
import { addSignerToProposal, updateProposalStatus } from '@/lib/firebase/proposalService';
import { PROGRAM_ID } from './constants';
import { compressPublicKey } from './bufferUtils';

// Constants
const SECP256R1_PROGRAM_ID = new PublicKey('Secp256r1SigVerify1111111111111111111111111');
const SECP256R1_ORDER = new BN('FFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551', 16);
const SECP256R1_HALF_ORDER = SECP256R1_ORDER.shrn(1);

// Các hằng số khác
// Các hằng số này cũng có thể import nhưng được định nghĩa ở đây để dễ kiểm soát

/**
 * Hàm chính để ký đề xuất
 */
export const handleSignProposal = async (
  connection: Connection,
  currentSigningProposal: any,
  walletAddress: PublicKey | string,
  guardianId: number,
  projectFeePayerKeypair: any,
  credentialId?: string
): Promise<string> => {
  // Chuyển đổi walletAddress thành PublicKey nếu cần
  const walletAddressPubkey = typeof walletAddress === 'string' 
    ? new PublicKey(walletAddress) 
    : walletAddress;
    
  if (!currentSigningProposal || !walletAddressPubkey || !connection || !projectFeePayerKeypair) {
    throw new Error("Không thể ký đề xuất: Thiếu thông tin cần thiết.");
  }
  
  try {
    // Tạo thông điệp để ký
    const timestamp = Math.floor(Date.now() / 1000);
    const proposalId = currentSigningProposal.proposalId;
    
    console.log("Đang chuẩn bị thông tin để ký đề xuất ID:", proposalId);
    
    // Step 1: Yêu cầu người dùng xác thực với WebAuthn
    const initialChallenge = new Uint8Array(32);
    window.crypto.getRandomValues(initialChallenge);
    
    // Yêu cầu người dùng chọn khóa WebAuthn
    console.log("Yêu cầu người dùng chọn khóa WebAuthn để xác thực");
    let credential;
    try {
      credential = await navigator.credentials.get({
        publicKey: {
          challenge: initialChallenge,
          timeout: 60000,
          userVerification: 'required',
          rpId: window.location.hostname,
        }
      }) as PublicKeyCredential;
    } catch (error) {
      console.error("Lỗi khi yêu cầu WebAuthn:", error);
      throw new Error("Người dùng đã hủy xác thực hoặc xác thực thất bại");
    }
    
    // Lấy credential ID từ xác thực
    const credentialIdString = Buffer.from(credential.rawId).toString('base64');
    console.log("Người dùng đã chọn credential ID:", credentialIdString);
    
    // Step 2: Lấy thông tin WebAuthn public key từ credential 
    const credentialMapping = await getWalletByCredentialId(credentialIdString);
    
    if (!credentialMapping || !credentialMapping.guardianPublicKey) {
      throw new Error("Không tìm thấy thông tin public key cho credential này");
    }
    
    // Lấy WebAuthn public key
    const webAuthnPubKey = Buffer.from(credentialMapping.guardianPublicKey);
    
    // In thông tin chi tiết về public key để debug
    console.log("=========== PUBLIC KEY DEBUG INFO ===========");
    console.log("WebAuthn Public Key length:", webAuthnPubKey.length);
    console.log("WebAuthn Public Key format:", webAuthnPubKey[0] === 0x04 ? 'Uncompressed (0x04)' : 
                                             (webAuthnPubKey[0] === 0x02 || webAuthnPubKey[0] === 0x03) ? 
                                             `Compressed (0x${webAuthnPubKey[0].toString(16)})` : 
                                             `Unknown (0x${webAuthnPubKey[0]?.toString(16) || 'undefined'})`);
    console.log("WebAuthn Public Key hex:", webAuthnPubKey.toString('hex'));
    // Kiểm tra định dạng JSON để xem có thể parse được không
    try {
      const decoded = JSON.parse(webAuthnPubKey.toString());
      console.log("WebAuthn Public Key là JSON:", decoded);
    } catch (e) {
      // Không phải JSON, là binary data
    }
    console.log("=========================================");
    
    // Step 3: Tính hash của public key (6 bytes đầu tiên)
    const hashBytes = sha256(webAuthnPubKey);
    const pubkeyHashBytes = hashBytes.slice(0, 6);
    const pubkeyHashHex = Array.from(pubkeyHashBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Step 4: Tạo thông điệp đầy đủ để ký
    const messageWithPubkey = `approve:proposal_${proposalId},guardian_${guardianId},timestamp:${timestamp},pubkey:${pubkeyHashHex}`;
    console.log("Thông điệp đầy đủ để ký:", messageWithPubkey);
    
    // Lấy response từ credential
    const response = credential.response as AuthenticatorAssertionResponse;
    
    // Chuẩn bị dữ liệu để ký
    const signature = new Uint8Array(response.signature);
    const authenticatorData = new Uint8Array(response.authenticatorData);
    const clientDataJSON = new Uint8Array(response.clientDataJSON);
    
    console.log('Đã ký thành công bằng WebAuthn');
    
    // Step 5: Tiếp tục quy trình gửi transaction lên blockchain
    // Tính PDA cho multisig và guardian
    const multisigPDA = walletAddressPubkey;
    const guardianPDA = await getGuardianPDA(multisigPDA, guardianId);
    
    // Tạo proposalPDA từ multisigPDA và proposalId
    const [proposalPubkey] = await PublicKey.findProgramAddress(
      [
        Buffer.from("proposal"),
        multisigPDA.toBuffer(),
        new BN(proposalId).toArrayLike(Buffer, "le", 8)
      ],
      PROGRAM_ID
    );
    
    console.log("Tạo giao dịch với thông tin:");
    console.log("- MultisigPDA:", multisigPDA.toString());
    console.log("- GuardianPDA:", guardianPDA.toString());
    console.log("- ProposalPDA:", proposalPubkey.toString());
    console.log("- GuardianID:", guardianId);
    console.log("- Timestamp:", timestamp);
    
    // Tạo transaction để approve proposal
    const tx = await createApproveProposalTx(
      proposalPubkey,
      multisigPDA,
      guardianPDA,
      guardianId,
      projectFeePayerKeypair.publicKey,
      signature,
      authenticatorData,
      clientDataJSON,
      proposalId,
      timestamp,
      credentialIdString
    );
    
    // Thiết lập recent blockhash và fee payer
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.feePayer = projectFeePayerKeypair.publicKey;
    
    // Ký transaction với project fee payer keypair
    tx.partialSign(projectFeePayerKeypair);
    
    // Gửi transaction 
    const txSignature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: 3
    });
    
    console.log("Giao dịch ký đề xuất đã được gửi:", txSignature);
    
    // Cập nhật trạng thái đề xuất
    await addSignerToProposal(
      walletAddressPubkey.toString(),
      currentSigningProposal.proposalId,
      webAuthnPubKey.toString('hex')
    );
    
    // Kiểm tra ngưỡng chữ ký (threshold) và cập nhật trạng thái nếu đạt đủ
    console.log("currentSigningProposal:", JSON.stringify({
      proposalId: currentSigningProposal.proposalId,
      threshold: currentSigningProposal.threshold,
      signers: currentSigningProposal.signers || [],
      status: currentSigningProposal.status
    }, null, 2));
    
    // Lấy lại thông tin đề xuất từ Firebase để đảm bảo có dữ liệu mới nhất
    try {
      const { getProposalById } = await import('@/lib/firebase/proposalService');
      const updatedProposal = await getProposalById(walletAddressPubkey.toString(), currentSigningProposal.proposalId);
      
      if (updatedProposal) {
        console.log("Đề xuất sau khi cập nhật:", JSON.stringify({
          proposalId: updatedProposal.proposalId,
          threshold: updatedProposal.requiredSignatures,
          signers: updatedProposal.signers || [],
          status: updatedProposal.status
        }, null, 2));
        
        // Số lượng chữ ký hiện tại và ngưỡng yêu cầu
        const signatureCount = updatedProposal.signers?.length || 0;
        const requiredSignatures = updatedProposal.requiredSignatures || 0;
        
        console.log(`Số chữ ký hiện tại (từ Firebase): ${signatureCount}/${requiredSignatures}`);
        
        // Kiểm tra nếu đủ ngưỡng
        if (signatureCount >= requiredSignatures) {
          console.log("Đề xuất đã đạt đủ chữ ký, cập nhật trạng thái thành Ready");
          
          // Cập nhật trạng thái đề xuất thành "Ready"
          await updateProposalStatus(
            walletAddressPubkey.toString(),
            currentSigningProposal.proposalId,
            "Ready"
          );
          
          console.log("Đã cập nhật trạng thái đề xuất thành Ready");
        } else {
          console.log("Chưa đủ số chữ ký để cập nhật trạng thái");
        }
      }
    } catch (error) {
      console.error("Lỗi khi lấy thông tin đề xuất mới nhất:", error);
    }
    
    return txSignature;
  } catch (error) {
    console.error("Lỗi khi ký đề xuất:", error);
    throw error;
  }
};

/**
 * Tạo transaction approve proposal
 */
export const createApproveProposalTx = async (
  proposalPubkey: PublicKey,
  multisigPDA: PublicKey,
  guardianPDA: PublicKey,
  guardianId: number,
  feePayer: PublicKey,
  webauthnSignature: Uint8Array,
  authenticatorData: Uint8Array,
  clientDataJSON: Uint8Array,
  proposalId: number,
  timestamp: number,
  credentialId?: string
): Promise<Transaction> => {
  // Tạo transaction mới
  const transaction = new Transaction();

  // Lấy WebAuthn public key từ credential, truyền credentialId nếu có
  console.log("Đang tìm WebAuthn public key...");
  
  try {
    // Lấy thông tin credential mapping từ Firebase
    const credentialMapping = await getWalletByCredentialId(credentialId || '');
    if (!credentialMapping || !credentialMapping.guardianPublicKey) {
      throw new Error("Không tìm thấy WebAuthn public key cho guardian này");
    }
    
    const webAuthnPubKey = Buffer.from(credentialMapping.guardianPublicKey);
    
    // In thông tin chi tiết về public key để debug
    console.log("=========== PUBLIC KEY DEBUG INFO ===========");
    console.log("WebAuthn Public Key length:", webAuthnPubKey.length);
    console.log("WebAuthn Public Key format:", webAuthnPubKey[0] === 0x04 ? 'Uncompressed (0x04)' : 
                                              (webAuthnPubKey[0] === 0x02 || webAuthnPubKey[0] === 0x03) ? 
                                              `Compressed (0x${webAuthnPubKey[0].toString(16)})` : 
                                              `Unknown (0x${webAuthnPubKey[0]?.toString(16) || 'undefined'})`);
    console.log("WebAuthn Public Key hex:", webAuthnPubKey.toString('hex'));
    // Kiểm tra định dạng JSON để xem có thể parse được không
    try {
      const decoded = JSON.parse(webAuthnPubKey.toString());
      console.log("WebAuthn Public Key là JSON:", decoded);
    } catch (e) {
      // Không phải JSON, là binary data
    }
    console.log("=========================================");
    
    // Tính hash của WebAuthn public key
    const hashBytes = sha256(webAuthnPubKey);
    // Lấy 6 bytes đầu tiên
    const pubkeyHashBytes = hashBytes.slice(0, 6);
    // Chuyển đổi sang hex string
    const pubkeyHashHex = Array.from(pubkeyHashBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // 1. Tạo message để ký
    const messageString = `approve:proposal_${proposalId},guardian_${guardianId},timestamp:${timestamp},pubkey:${pubkeyHashHex}`;
    const messageBuffer = Buffer.from(messageString);
    console.log("Thông điệp được ký:", messageString);

    // 2. Tính hash của clientDataJSON
    const clientDataHash = await crypto.subtle.digest('SHA-256', clientDataJSON);
    const clientDataHashBytes = new Uint8Array(clientDataHash);

    // 3. Tạo verification data: authenticatorData + hash(clientDataJSON)
    const verificationData = new Uint8Array(authenticatorData.length + clientDataHashBytes.length);
    verificationData.set(new Uint8Array(authenticatorData), 0);
    verificationData.set(clientDataHashBytes, authenticatorData.length);

    // 4. Chuyển đổi signature từ DER sang raw format
    const rawSignature = derToRaw(webauthnSignature);
    
    // 5. Chuẩn hóa signature về dạng Low-S
    const normalizedSignature = normalizeSignatureToLowS(Buffer.from(rawSignature));
    
    // Chuyển đổi khóa công khai thành dạng nén (compressed)
    const compressedPubKey = compressPublicKey(webAuthnPubKey);
    
    // 6. Tạo instruction Secp256r1 để xác thực chữ ký
    const secp256r1Ix = createSecp256r1Instruction(
      Buffer.from(verificationData),
      compressedPubKey,
      normalizedSignature,
      false
    );
    
    // Thêm secp256r1 instruction vào transaction
    transaction.add(secp256r1Ix);
    
    // 7. Tạo instruction approve_proposal
    
    // Tạo dữ liệu cho approve_proposal instruction
    const approveProposalDiscriminator = Buffer.from([136, 108, 102, 85, 98, 114, 7, 147]); // Discriminator từ IDL
    
    // Tạo các buffer cho tham số
    const proposalIdBuffer = Buffer.alloc(8);
    proposalIdBuffer.writeBigUInt64LE(BigInt(proposalId), 0);
    
    const guardianIdBuffer = Buffer.alloc(8);
    guardianIdBuffer.writeBigUInt64LE(BigInt(guardianId), 0);
    
    const timestampBuffer = Buffer.alloc(8);
    timestampBuffer.writeBigInt64LE(BigInt(timestamp), 0);
    
    // Tạo message buffer và độ dài
    const messageLenBuffer = Buffer.alloc(4);
    messageLenBuffer.writeUInt32LE(messageBuffer.length, 0);
    
    // Tạo dữ liệu instruction
    const approveData = Buffer.concat([
      approveProposalDiscriminator,
      proposalIdBuffer,
      guardianIdBuffer,
      timestampBuffer,
      messageLenBuffer,
      messageBuffer
    ]);
    
    // Tìm PDA cho signature từ proposal và guardianId
    const [signaturePDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from("signature"),
        proposalPubkey.toBuffer(),
        new BN(guardianId).toArrayLike(Buffer, "le", 8)
      ],
      PROGRAM_ID
    );
    
    // Tạo instruction approve_proposal với các tài khoản theo đúng thứ tự của IDL
    const approveInstruction = new TransactionInstruction({
      keys: [
        { pubkey: multisigPDA, isSigner: false, isWritable: true },
        { pubkey: proposalPubkey, isSigner: false, isWritable: true },
        { pubkey: signaturePDA, isSigner: false, isWritable: true },
        { pubkey: guardianPDA, isSigner: false, isWritable: false },
        { pubkey: feePayer, isSigner: true, isWritable: true },
        { pubkey: new PublicKey('Sysvar1nstructions1111111111111111111111111'), isSigner: false, isWritable: false },
        { pubkey: new PublicKey('SysvarC1ock11111111111111111111111111111111'), isSigner: false, isWritable: false },
        { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false }
      ],
      programId: PROGRAM_ID,
      data: approveData
    });
    
    // Thêm instruction vào transaction
    transaction.add(approveInstruction);
    
    return transaction;
  } catch (error) {
    console.error("Lỗi khi tạo transaction approve proposal:", error);
    throw error;
  }
};

/**
 * Chuyển đổi chữ ký từ định dạng DER sang định dạng raw
 */
export const derToRaw = (derSignature: Uint8Array): Uint8Array => {
  try {
    // Kiểm tra format DER
    if (derSignature[0] !== 0x30) {
      throw new Error('Chữ ký không đúng định dạng DER: byte đầu tiên không phải 0x30');
    }
    
    // DER format: 0x30 [total-length] 0x02 [r-length] [r] 0x02 [s-length] [s]
    const rLength = derSignature[3];
    const rStart = 4;
    const rEnd = rStart + rLength;
    
    const sLength = derSignature[rEnd + 1];
    const sStart = rEnd + 2;
    const sEnd = sStart + sLength;
    
    // Trích xuất r và s
    let r = derSignature.slice(rStart, rEnd);
    let s = derSignature.slice(sStart, sEnd);
    
    // Xử lý trường hợp r có 33 bytes với byte đầu tiên là 0x00
    if (r.length === 33 && r[0] === 0x00) {
      r = r.slice(1);
    }
    
    // Xử lý trường hợp s có 33 bytes với byte đầu tiên là 0x00
    if (s.length === 33 && s[0] === 0x00) {
      s = s.slice(1);
    }
    
    // Chuẩn bị r và s cho định dạng raw (mỗi phần 32 bytes)
    const rPadded = new Uint8Array(32);
    const sPadded = new Uint8Array(32);
    
    if (r.length <= 32) {
      // Trường hợp r ngắn hơn 32 bytes, thêm padding
      rPadded.set(r, 32 - r.length);
    } else {
      // Trường hợp r dài hơn 32 bytes, lấy 32 bytes cuối
      rPadded.set(r.slice(r.length - 32));
    }
    
    if (s.length <= 32) {
      // Trường hợp s ngắn hơn 32 bytes, thêm padding
      sPadded.set(s, 32 - s.length);
    } else {
      // Trường hợp s dài hơn 32 bytes, lấy 32 bytes cuối
      sPadded.set(s.slice(s.length - 32));
    }
    
    // Nối r và s lại
    const rawSignature = new Uint8Array(64);
    rawSignature.set(rPadded);
    rawSignature.set(sPadded, 32);
    
    return rawSignature;
  } catch (e) {
    console.error('Lỗi khi chuyển đổi DER sang raw:', e);
    throw e;
  }
};

/**
 * Chuẩn hóa chữ ký về dạng Low-S
 */
export const normalizeSignatureToLowS = (signature: Buffer): Buffer => {
  // Phân tách r và s từ signature (mỗi cái 32 bytes)
  const r = signature.slice(0, 32);
  const s = signature.slice(32, 64);
  
  // Chuyển s thành BN để so sánh với HALF_ORDER
  const sBN = new BN(s);
  
  // Kiểm tra nếu s > half_order
  if (sBN.gt(SECP256R1_HALF_ORDER)) {
    // Tính s' = order - s
    const sNormalized = SECP256R1_ORDER.sub(sBN);
    const sNormalizedBuffer = sNormalized.toArrayLike(Buffer, 'be', 32);
    return Buffer.concat([r, sNormalizedBuffer]);
  }
  
  return signature;
};

/**
 * Tạo verification data từ WebAuthn assertion
 */
export const createWebAuthnVerificationData = async (
  assertion: {
    signature: Uint8Array;
    authenticatorData: Uint8Array;
    clientDataJSON: Uint8Array;
  }
): Promise<Uint8Array> => {
  // 1. Tính hash của clientDataJSON
  const clientDataHash = await crypto.subtle.digest('SHA-256', assertion.clientDataJSON);
  const clientDataHashBytes = new Uint8Array(clientDataHash);
  
  // 2. Tạo verification data: authenticatorData + hash(clientDataJSON)
  const verificationData = new Uint8Array(assertion.authenticatorData.length + clientDataHashBytes.length);
  verificationData.set(new Uint8Array(assertion.authenticatorData), 0);
  verificationData.set(clientDataHashBytes, assertion.authenticatorData.length);
  
  return verificationData;
};

/**
 * Tạo instruction cho chương trình Secp256r1SigVerify
 */
export const createSecp256r1Instruction = (
  message: Buffer, 
  publicKey: Buffer,
  signature: Buffer,
  shouldFlipPublicKey: boolean = false
): TransactionInstruction => {
  // Đảm bảo public key có đúng định dạng (compressed, 33 bytes)
  if (publicKey.length !== 33) {
    throw new Error(`Public key phải có đúng 33 bytes, nhưng có ${publicKey.length} bytes`);
  }
  
  // Đảm bảo signature có đúng 64 bytes
  if (signature.length !== 64) {
    throw new Error(`Signature phải có đúng 64 bytes, nhưng có ${signature.length} bytes`);
  }
  
  // Chuyển đổi public key nếu cần
  let pubkeyToUse = publicKey;
  if (shouldFlipPublicKey) {
    // Tạo public key mới với byte đầu tiên bị đảo
    pubkeyToUse = Buffer.from(publicKey);
    pubkeyToUse[0] = pubkeyToUse[0] === 0x02 ? 0x03 : 0x02;
  }
  
  // Các hằng số
  const COMPRESSED_PUBKEY_SIZE = 33;
  const SIGNATURE_SIZE = 64;
  const DATA_START = 16; // 1 byte + 1 byte padding + 14 bytes offsets
  const SIGNATURE_OFFSETS_START = 2;
  
  // Tính tổng kích thước dữ liệu
  const totalSize = DATA_START + SIGNATURE_SIZE + COMPRESSED_PUBKEY_SIZE + message.length;
  const instructionData = Buffer.alloc(totalSize);
  
  // Tính offset
  const numSignatures = 1;
  const publicKeyOffset = DATA_START;
  const signatureOffset = publicKeyOffset + COMPRESSED_PUBKEY_SIZE;
  const messageDataOffset = signatureOffset + SIGNATURE_SIZE;

  // Ghi số lượng chữ ký và padding
  instructionData.writeUInt8(numSignatures, 0);
  instructionData.writeUInt8(0, 1); // padding

  // Tạo và ghi offsets
  const offsets = {
    signature_offset: signatureOffset,
    signature_instruction_index: 0xffff, // u16::MAX
    public_key_offset: publicKeyOffset,
    public_key_instruction_index: 0xffff,
    message_data_offset: messageDataOffset,
    message_data_size: message.length,
    message_instruction_index: 0xffff,
  };

  // Ghi offsets
  instructionData.writeUInt16LE(offsets.signature_offset, SIGNATURE_OFFSETS_START);
  instructionData.writeUInt16LE(offsets.signature_instruction_index, SIGNATURE_OFFSETS_START + 2);
  instructionData.writeUInt16LE(offsets.public_key_offset, SIGNATURE_OFFSETS_START + 4);
  instructionData.writeUInt16LE(offsets.public_key_instruction_index, SIGNATURE_OFFSETS_START + 6);
  instructionData.writeUInt16LE(offsets.message_data_offset, SIGNATURE_OFFSETS_START + 8);
  instructionData.writeUInt16LE(offsets.message_data_size, SIGNATURE_OFFSETS_START + 10);
  instructionData.writeUInt16LE(offsets.message_instruction_index, SIGNATURE_OFFSETS_START + 12);

  // Ghi dữ liệu vào instruction
  pubkeyToUse.copy(instructionData, publicKeyOffset);
  signature.copy(instructionData, signatureOffset);
  message.copy(instructionData, messageDataOffset);
  
  return new TransactionInstruction({
    keys: [],
    programId: SECP256R1_PROGRAM_ID,
    data: instructionData,
  });
}; 