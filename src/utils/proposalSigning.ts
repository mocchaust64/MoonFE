import { PublicKey, Transaction, TransactionInstruction, Connection, SystemProgram,Keypair } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { sha256 } from '@noble/hashes/sha256';
import { getWalletByCredentialId } from '../lib/firebase/webAuthnService';
import { getGuardianPDA } from './credentialUtils';
import { addSignerToProposal, Proposal} from '../lib/firebase/proposalService';
import { PROGRAM_ID } from './constants';
import { compressPublicKey } from './bufferUtils';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { createSecp256r1Instruction } from '../lib/solana/secp256r1';




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
    
    if (!credentialMapping?.guardianPublicKey) {
      throw new Error("Không tìm thấy thông tin public key cho credential này");
    }
    
    // Lấy WebAuthn public key
    const webAuthnPubKey = Buffer.from(credentialMapping.guardianPublicKey);
    
    // In thông tin chi tiết về public key để debug
    console.log("=========== PUBLIC KEY DEBUG INFO ===========");
    console.log("WebAuthn Public Key length:", webAuthnPubKey.length);
    
    let formatDescription;
    if (webAuthnPubKey[0] === 0x04) {
      formatDescription = 'Uncompressed (0x04)';
    } else if (webAuthnPubKey[0] === 0x02 || webAuthnPubKey[0] === 0x03) {
      formatDescription = `Compressed (0x${webAuthnPubKey[0].toString(16)})`;
    } else {
      const hexValue = webAuthnPubKey[0]?.toString(16) ?? 'undefined';
      formatDescription = `Unknown (0x${hexValue})`;
    }
    console.log("WebAuthn Public Key format:", formatDescription);
    console.log("WebAuthn Public Key hex:", webAuthnPubKey.toString('hex'));
    // Kiểm tra định dạng JSON để xem có thể parse được không
    try {
      const decoded = JSON.parse(webAuthnPubKey.toString());
      console.log("WebAuthn Public Key là JSON:", decoded);
    } catch (e) {
      console.log("WebAuthn Public Key không phải JSON (binary data)");
      console.warn("Chi tiết lỗi parse:", e);
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
    const guardianPDA = getGuardianPDA(multisigPDA, guardianId);
    
    // Tạo proposalPDA từ multisigPDA và proposalId
    const [proposalPubkey] = PublicKey.findProgramAddressSync(
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
    const tx = await createApproveProposalTx({
      proposalPubkey,
      multisigPDA,
      guardianPDA,
      guardianId,
      feePayer: projectFeePayerKeypair.publicKey,
      webauthnSignature: signature,
      authenticatorData,
      clientDataJSON,
      proposalId,
      timestamp,
      credentialId: credentialIdString
    });
    
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
      signers: currentSigningProposal.signers ?? [],
      status: currentSigningProposal.status
    }, null, 2));
    
    return txSignature;
  } catch (error) {
    console.error("Lỗi khi ký đề xuất:", error);
    throw error;
  }
};

// Thêm interface để nhóm các tham số
interface ApproveProposalParams {
  proposalPubkey: PublicKey;
  multisigPDA: PublicKey;
  guardianPDA: PublicKey;
  guardianId: number;
  feePayer: PublicKey;
  webauthnSignature: Uint8Array;
  authenticatorData: Uint8Array;
  clientDataJSON: Uint8Array;
  proposalId: number;
  timestamp: number;
  credentialId?: string;
}

// Vấn đề S107: Quá nhiều tham số
export const createApproveProposalTx = async (
  params: ApproveProposalParams
): Promise<Transaction> => {
  const {
    proposalPubkey,
    multisigPDA,
    guardianPDA,
    guardianId,
    feePayer,
    webauthnSignature,
    authenticatorData,
    clientDataJSON,
    proposalId,
    timestamp,
    credentialId
  } = params;

  // Tạo transaction mới
  const transaction = new Transaction();

  // Lấy WebAuthn public key từ credential, truyền credentialId nếu có
  console.log("Đang tìm WebAuthn public key...");
  
  try {
    // Lấy thông tin credential mapping từ Firebase
    const credentialMapping = await getWalletByCredentialId(credentialId ?? '');
    if (!credentialMapping?.guardianPublicKey) {
      throw new Error("Không tìm thấy WebAuthn public key cho guardian này");
    }
    
    const webAuthnPubKey = Buffer.from(credentialMapping.guardianPublicKey);
    
    // In thông tin chi tiết về public key để debug
    console.log("=========== PUBLIC KEY DEBUG INFO ===========");
    console.log("WebAuthn Public Key length:", webAuthnPubKey.length);
    
    let formatDescription;
    if (webAuthnPubKey[0] === 0x04) {
      formatDescription = 'Uncompressed (0x04)';
    } else if (webAuthnPubKey[0] === 0x02 || webAuthnPubKey[0] === 0x03) {
      formatDescription = `Compressed (0x${webAuthnPubKey[0].toString(16)})`;
    } else {
      const hexValue = webAuthnPubKey[0]?.toString(16) ?? 'undefined';
      formatDescription = `Unknown (0x${hexValue})`;
    }
    console.log("WebAuthn Public Key format:", formatDescription);
    console.log("WebAuthn Public Key hex:", webAuthnPubKey.toString('hex'));
    // Kiểm tra định dạng JSON để xem có thể parse được không
    try {
      const decoded = JSON.parse(webAuthnPubKey.toString());
      console.log("WebAuthn Public Key là JSON:", decoded);
    } catch (e) {
      console.log("WebAuthn Public Key không phải JSON (binary data)");
      console.warn("Chi tiết lỗi parse:", e);
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
    const [signaturePDA] = PublicKey.findProgramAddressSync(
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
 * Tìm và trả về WebAuthn public key từ localStorage
 */
function getWebAuthnPublicKeyFromLocalStorage(
  multisigAddress: string,
  guardianId: number
): { publicKeyArray: Uint8Array; guardianId: number } | null {
  const storedCredentialId = localStorage.getItem('current_credential_id');
  if (!storedCredentialId) {
    return null;
  }

  const localStorageKey = "webauthn_credential_" + storedCredentialId;
  const localMapping = localStorage.getItem(localStorageKey);
  
  if (!localMapping) {
    return null;
  }
  
  try {
    const mappingData = JSON.parse(localMapping);
    console.log("Thông tin WebAuthn từ localStorage:", {
      credentialId: storedCredentialId,
      guardianId: mappingData.guardianId,
      walletAddress: mappingData.walletAddress
    });
    
    // Kiểm tra nếu mapping có guardianPublicKey và khớp với ví multisig
    if (mappingData.guardianPublicKey && 
        mappingData.walletAddress === multisigAddress) {
      
      // Cập nhật guardian ID trong localStorage nếu khác
      const actualGuardianId = updateLocalGuardianIdIfNeeded(mappingData.guardianId, guardianId);
      
      console.log("Sử dụng thông tin guardian từ localStorage");
      const publicKeyArray = Array.isArray(mappingData.guardianPublicKey) 
        ? new Uint8Array(mappingData.guardianPublicKey)
        : mappingData.guardianPublicKey;
        
      // Log chi tiết về key
      logPublicKeyDebugInfo(publicKeyArray);
      
      return { publicKeyArray, guardianId: actualGuardianId };
    }
  } catch (e) {
    console.error("Lỗi khi parse thông tin credential từ localStorage:", e);
  }
  
  return null;
}

/**
 * Cập nhật guardianId trong localStorage nếu khác với guardianId hiện tại
 */
function updateLocalGuardianIdIfNeeded(mappingGuardianId: number, currentGuardianId: number): number {
  if (mappingGuardianId !== currentGuardianId) {
    console.warn(`QUAN TRỌNG: GuardianId từ localStorage (${mappingGuardianId}) khác với guardianId truyền vào (${currentGuardianId}). Sử dụng guardianId từ localStorage!`);
    // Cập nhật lại guardianId trong localStorage
    localStorage.setItem('current_guardian_id', mappingGuardianId.toString());
    return mappingGuardianId;
  }
  return currentGuardianId;
}

/**
 * Log thông tin debug về public key
 */
function logPublicKeyDebugInfo(publicKeyArray: Uint8Array): void {
  console.log("=========== PUBLIC KEY DEBUG INFO ===========");
  console.log("WebAuthn Public Key length:", publicKeyArray.length);
  
  let formatDescription = "Unknown";
  if (publicKeyArray[0] === 2) {
    formatDescription = "Compressed (0x2)";
  } else if (publicKeyArray[0] === 3) {
    formatDescription = "Compressed (0x3)";
  } else if (publicKeyArray[0] === 4) {
    formatDescription = "Uncompressed (0x4)";
  }
  
  console.log("WebAuthn Public Key format:", formatDescription);
  console.log("WebAuthn Public Key hex:", Buffer.from(publicKeyArray).toString('hex'));
  console.log("=========================================");
}

/**
 * Lưu thông tin guardian vào localStorage
 */
function saveGuardianToLocalStorage(
  guardianCredential: any, 
  publicKeyArray: Uint8Array
): void {
  try {
    localStorage.setItem('current_guardian_id', guardianCredential.guardianId.toString());
    localStorage.setItem('current_credential_id', guardianCredential.credentialId);
    localStorage.setItem(
      "webauthn_credential_" + guardianCredential.credentialId,
      JSON.stringify({
        credentialId: guardianCredential.credentialId,
        walletAddress: guardianCredential.walletAddress,
        guardianPublicKey: Array.from(publicKeyArray),
        guardianId: guardianCredential.guardianId
      })
    );
    console.log("Đã cập nhật thông tin guardian vào localStorage");
  } catch (e) {
    console.warn("Không thể lưu vào localStorage:", e);
  }
}

/**
 * Tìm WebAuthn public key bằng credential ID từ Firebase
 */
async function findPublicKeyByCredentialId(
  storedCredentialId: string, 
  multisigAddress: string, 
  guardianId: number,
  getWalletByCredentialId: Function,
  normalizeCredentialId: Function
): Promise<{ publicKeyArray: Uint8Array; guardianId: number } | null> {
  console.log("Tìm guardian theo credential ID:", storedCredentialId);
  
  const normalizedId = await normalizeCredentialId(storedCredentialId);
  const credentialData = await getWalletByCredentialId(normalizedId);
  
  if (!credentialData || 
      credentialData.walletAddress !== multisigAddress || 
      !Array.isArray(credentialData.guardianPublicKey)) {
    return null;
  }
  
  console.log("Tìm thấy mapping theo credential ID:", {
    guardianId: credentialData.guardianId,
    walletAddress: credentialData.walletAddress
  });
  
  // Cập nhật guardian ID nếu cần
  const actualGuardianId = updateLocalGuardianIdIfNeeded(credentialData.guardianId, guardianId);
  
  const publicKeyArray = new Uint8Array(credentialData.guardianPublicKey);
  
  // Log chi tiết về key
  logPublicKeyDebugInfo(publicKeyArray);
  
  return { publicKeyArray, guardianId: actualGuardianId };
}

/**
 * Tìm WebAuthn public key bằng multisig và guardian ID từ Firebase
 */
async function findPublicKeyByMultisigAndGuardianId(
  multisigAddress: string, 
  guardianId: number,
  getCredentialsByWallet: Function
): Promise<{ publicKeyArray: Uint8Array; guardianCredential: any } | null> {
  console.log("Tìm guardian theo multisig và guardian ID:", multisigAddress, guardianId);
  
  const credentials = await getCredentialsByWallet(multisigAddress);
  
  // Tìm guardian phù hợp với guardianId
  const guardianCredential = credentials.find((cred: { guardianId: number; guardianPublicKey: any }) => 
    cred.guardianId === guardianId
  );
  
  if (!guardianCredential || !Array.isArray(guardianCredential.guardianPublicKey)) {
    console.error(`Không tìm thấy guardian với ID ${guardianId} cho ví ${multisigAddress}`);
    console.error("Danh sách guardians tìm thấy:", credentials.map((c: { guardianId: number; credentialId: string }) => 
      ({ id: c.guardianId, credentialId: c.credentialId })
    ));
    return null;
  }
  
  console.log("Tìm thấy guardian theo multisig và guardian ID:", {
    guardianId: guardianCredential.guardianId,
    credentialId: guardianCredential.credentialId,
  });
  
  const publicKeyArray = new Uint8Array(guardianCredential.guardianPublicKey);
  
  // Log chi tiết về key
  logPublicKeyDebugInfo(publicKeyArray);
  
  return { publicKeyArray, guardianCredential };
}

/**
 * Lấy WebAuthn public key cho guardian từ ví multisig
 */
export async function getGuardianWebAuthnPublicKey(
  multisigPDA: PublicKey | string,
  guardianId: number
): Promise<Uint8Array | null> {
  try {
    console.log("Đang tìm WebAuthn public key...");
    
    // Chuẩn hóa input
    const multisigAddress = typeof multisigPDA === 'string' 
      ? multisigPDA 
      : multisigPDA.toString();
    
    console.log(`MultisigPDA: ${multisigAddress}, GuardianID: ${guardianId}`);
    
    // 1. Kiểm tra trong localStorage trước
    const localResult = getWebAuthnPublicKeyFromLocalStorage(multisigAddress, guardianId);
    if (localResult) {
      return localResult.publicKeyArray;
    }
    
    // 2. Nếu không tìm thấy trong localStorage, truy vấn từ Firebase
    try {
      const { getWalletByCredentialId, getCredentialsByWallet, normalizeCredentialId } = 
        await import("@/lib/firebase/webAuthnService");
      
      // 2.1 Nếu có credential ID, ưu tiên tìm theo credential ID
      const storedCredentialId = localStorage.getItem('current_credential_id');
      if (storedCredentialId) {
        const credentialResult = await findPublicKeyByCredentialId(
          storedCredentialId, 
          multisigAddress, 
          guardianId,
          getWalletByCredentialId,
          normalizeCredentialId
        );
        
        if (credentialResult) {
          return credentialResult.publicKeyArray;
        }
      }
      
      // 2.2 Nếu không tìm thấy theo credential ID, tìm theo multisigPDA và guardianId
      const multisigResult = await findPublicKeyByMultisigAndGuardianId(
        multisigAddress, 
        guardianId,
        getCredentialsByWallet
      );
      
      if (multisigResult) {
        // Lưu kết quả vào localStorage để lần sau nhanh hơn
        saveGuardianToLocalStorage(multisigResult.guardianCredential, multisigResult.publicKeyArray);
        return multisigResult.publicKeyArray;
      }
      
      // Không tìm thấy
      return null;
      
    } catch (error) {
      console.error("Lỗi khi truy vấn Firebase:", error);
      throw new Error(`Lỗi khi lấy WebAuthn public key: ${error instanceof Error ? error.message : 'Lỗi không xác định'}`);
    }
  } catch (error) {
    console.error(`Lỗi khi lấy WebAuthn public key:`, error);
    return null;
  }
}

/**
 * Lấy thông tin guardian từ Firebase theo multisigAddress và guardianId
 */
async function getGuardianCredentialByMultisigAndId(multisigAddress: string, guardianId: number) {
  try {
    // Tạo query tìm kiếm guardian trong webauthn_credentials
    const guardiansRef = collection(db, "webauthn_credentials");
    const q = query(
      guardiansRef,
      where("walletAddress", "==", multisigAddress),
      where("guardianId", "==", guardianId)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.error(`Không tìm thấy guardian với ID ${guardianId} cho ví ${multisigAddress}`);
      return null;
    }
    
    // Lấy dữ liệu của guardian đầu tiên tìm thấy
    return querySnapshot.docs[0].data();
  } catch (error) {
    console.error("Lỗi khi truy vấn thông tin guardian:", error);
    return null;
  }
}

/**
 * Cập nhật danh sách người ký đề xuất trong Firebase
 */
async function updateProposalSigners(proposal: Proposal, guardianId: number, txSignature: string) {
  try {
    // Sử dụng hàm addSignerToProposal
    await addSignerToProposal(
      proposal.multisigAddress,
      proposal.proposalId,
      `guardian_${guardianId}`
    );
    console.log(`Đã cập nhật thông tin người ký cho đề xuất ${proposal.proposalId}, guardian ${guardianId}`);
  } catch (error) {
    console.error("Lỗi khi cập nhật thông tin người ký:", error);
  }
}

/**
 * Lấy guardianId từ tham số hoặc localStorage
 */
function getActualGuardianId(guardianId?: number): number {
  if (guardianId !== undefined) {
    console.log("Sử dụng guardianId được truyền vào:", guardianId);
    return guardianId;
  }
  
  console.log("guardianId không được cung cấp, lấy từ localStorage...");
  const storedGuardianId = localStorage.getItem("current_guardian_id");
  
  if (!storedGuardianId) {
    console.error("Không tìm thấy guardian ID trong localStorage");
    throw new Error("Không tìm thấy guardian ID, không thể ký đề xuất");
  }
  
  const parsedId = parseInt(storedGuardianId);
  console.log("Đã lấy guardianId từ localStorage:", parsedId);
  return parsedId;
}

/**
 * Lấy credentialId từ tham số hoặc localStorage
 */
function getActualCredentialId(credentialId?: string): string {
  if (credentialId) {
    return credentialId;
  }
  
  console.log("credentialId không được cung cấp, lấy từ localStorage...");
  const storedCredentialId = localStorage.getItem("current_credential_id");
  
  if (!storedCredentialId) {
    throw new Error("Không tìm thấy credential ID, không thể ký đề xuất");
  }
  
  return storedCredentialId;
}

/**
 * Kiểm tra thông tin guardianId từ localStorage
 */
function checkLocalStorageGuardianInfo(storedCredentialId: string, actualGuardianId: number): void {
  if (!storedCredentialId) return;
  
  const localStorageKey = "webauthn_credential_" + storedCredentialId;
  const localMapping = localStorage.getItem(localStorageKey);
  
  if (!localMapping) return;
  
  try {
    const mappingData = JSON.parse(localMapping);
    console.log("Thông tin credential từ localStorage:", {
      credentialId: storedCredentialId,
      guardianId: mappingData.guardianId,
      walletAddress: mappingData.walletAddress
    });
    
    // Kiểm tra nếu guardianId từ localStorage khác với guardianId đang sử dụng
    if (mappingData.guardianId !== actualGuardianId) {
      console.warn("Cảnh báo: guardianId từ localStorage khác với guardianId đang sử dụng:", 
        { fromMapping: mappingData.guardianId, current: actualGuardianId });
    }
  } catch (e) {
    console.error("Lỗi khi parse thông tin credential từ localStorage:", e);
  }
}

/**
 * Tính toán PDA cho guardian và proposal
 */
function calculatePDAs(
  multisigPDA: PublicKey,
  guardianId: number,
  proposalId: number
): { guardianPDA: PublicKey; proposalPDA: PublicKey } {
  // Tính toán guardian PDA
  const [guardianPDA] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("guardian"),
      multisigPDA.toBuffer(),
      new BN(guardianId).toArrayLike(Buffer, "le", 8),
    ],
    PROGRAM_ID
  );
  
  console.log("Guardian PDA:", guardianPDA.toString());
  
  // Tính toán proposal PDA
  const [proposalPDA] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("proposal"),
      multisigPDA.toBuffer(),
      new BN(proposalId).toArrayLike(Buffer, "le", 8),
    ],
    PROGRAM_ID
  );
  
  console.log("Proposal PDA:", proposalPDA.toString());
  
  return { guardianPDA, proposalPDA };
}

/**
 * Lấy chữ ký WebAuthn cho đề xuất
 */
async function getWebAuthnSignature(
  proposalId: number,
  credentialId: string
): Promise<{ 
  signature: Uint8Array; 
  clientDataJSON: Uint8Array;
  challenge: Buffer;
  timestamp: number;
}> {
  // Tạo thông điệp cần ký
  const timestamp = Math.floor(Date.now() / 1000);
  console.log("Current timestamp:", timestamp);
  
  const challenge = Buffer.concat([
    new BN(proposalId).toArrayLike(Buffer, "le", 8),
    new BN(timestamp).toArrayLike(Buffer, "le", 8),
  ]);
  
  // Tạo tùy chọn cho WebAuthn
  const publicKeyCredentialRequestOptions = {
    challenge,
    timeout: 60000,
    rpId: window.location.hostname,
    userVerification: "preferred" as UserVerificationRequirement,
    allowCredentials: [
      {
        id: Uint8Array.from(
          atob(credentialId),
          (c) => c.charCodeAt(0)
        ),
        type: "public-key" as PublicKeyCredentialType,
      },
    ],
  };
  
  console.log("Đang yêu cầu WebAuthn signature...");
  
  // Yêu cầu chữ ký WebAuthn
  const credential = (await navigator.credentials.get({
    publicKey: publicKeyCredentialRequestOptions,
  })) as PublicKeyCredential;
  
  // Xử lý kết quả và lấy chữ ký
  const response = credential.response as AuthenticatorAssertionResponse;
  const signature = new Uint8Array(response.signature);
  const clientDataJSON = new Uint8Array(response.clientDataJSON);
  
  console.log("Đã nhận WebAuthn signature");
  
  return { 
    signature, 
    clientDataJSON,
    challenge,
    timestamp
  };
}

/**
 * Tạo instruction approve_proposal
 */
function createApproveProposalInstruction(
  params: {
    multisigPDA: PublicKey;
    guardianPDA: PublicKey;
    proposalPDA: PublicKey;
    feePayer: PublicKey;
    proposalId: number;
    timestamp: number;
    clientDataJSON: Uint8Array;
    signature: Uint8Array;
    guardianWebAuthnPubkey: Uint8Array;
  }
): TransactionInstruction {
  const {
    multisigPDA,
    guardianPDA,
    proposalPDA,
    feePayer,
    proposalId,
    timestamp,
    clientDataJSON,
    signature,
    guardianWebAuthnPubkey
  } = params;
  
  // Tạo discriminator từ IDL
  const approveProposalDiscriminator = Buffer.from([136, 108, 102, 85, 98, 114, 7, 147]);

  // Tạo các buffer cho tham số
  const proposalIdBuffer = Buffer.alloc(8);
  proposalIdBuffer.writeBigUInt64LE(BigInt(proposalId), 0);

  const timestampBuffer = Buffer.alloc(8);
  timestampBuffer.writeBigInt64LE(BigInt(timestamp), 0);

  // Chuẩn bị clientDataJSON buffer và độ dài
  const clientDataJSONLenBuffer = Buffer.alloc(4);
  clientDataJSONLenBuffer.writeUInt32LE(clientDataJSON.length, 0);

  // Chuẩn bị signature buffer và độ dài
  const signatureLenBuffer = Buffer.alloc(4);
  signatureLenBuffer.writeUInt32LE(signature.length, 0);

  // Chuẩn bị guardianPublicKey buffer và độ dài
  const guardianPubkeyLenBuffer = Buffer.alloc(4);
  guardianPubkeyLenBuffer.writeUInt32LE(guardianWebAuthnPubkey.length, 0);

  // Tạo dữ liệu instruction
  const approveData = Buffer.concat([
    approveProposalDiscriminator,
    proposalIdBuffer,
    timestampBuffer,
    clientDataJSONLenBuffer,
    Buffer.from(clientDataJSON),
    signatureLenBuffer,
    Buffer.from(signature),
    guardianPubkeyLenBuffer,
    Buffer.from(guardianWebAuthnPubkey)
  ]);

  // Tạo instruction
  return new TransactionInstruction({
    keys: [
      { pubkey: multisigPDA, isSigner: false, isWritable: false },
      { pubkey: guardianPDA, isSigner: false, isWritable: false },
      { pubkey: proposalPDA, isSigner: false, isWritable: true },
      { pubkey: feePayer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: approveData
  });
}

/**
 * Ký đề xuất bằng WebAuthn và gửi transaction lên blockchain
 */
export async function signProposalWithWebAuthn(
  connection: Connection,
  proposal: Proposal,
  multisigPDA: PublicKey,
  guardianId: number | undefined,
  feePayer: Keypair,
  credentialId?: string,
): Promise<string> {
  console.log("Bắt đầu ký đề xuất với WebAuthn...");
  console.log("Proposal ID:", proposal.proposalId);
  
  try {
    // 1. Lấy guardianId từ tham số hoặc localStorage
    const actualGuardianId = getActualGuardianId(guardianId);
    console.log("Guardian ID cuối cùng sử dụng:", actualGuardianId);
    
    // 2. Lấy credentialId từ tham số hoặc localStorage
    const actualCredentialId = getActualCredentialId(credentialId);
    console.log("Đang sử dụng credentialId:", actualCredentialId);
    
    // 3. Kiểm tra thông tin mapping từ localStorage
    const storedCredentialId = localStorage.getItem("current_credential_id");
    checkLocalStorageGuardianInfo(storedCredentialId ?? "", actualGuardianId);
    
    // 4. Lấy WebAuthn public key của guardian từ Firebase
    const guardianWebAuthnPubkey = await getGuardianWebAuthnPublicKey(multisigPDA, actualGuardianId);
    
    if (!guardianWebAuthnPubkey) {
      throw new Error(`Không tìm thấy WebAuthn public key cho guardian ID ${actualGuardianId}`);
    }
    
    // 5. Tính toán PDA cho guardian và proposal
    const { guardianPDA, proposalPDA } = calculatePDAs(
      multisigPDA, 
      actualGuardianId, 
      proposal.proposalId
    );
    
    // 6. Lấy chữ ký WebAuthn cho đề xuất
    const { 
      signature, 
      clientDataJSON, 
      timestamp 
    } = await getWebAuthnSignature(proposal.proposalId, actualCredentialId);
    
    // 7. Tạo instruction approve_proposal
    const approveInstruction = createApproveProposalInstruction({
      multisigPDA,
      guardianPDA,
      proposalPDA,
      feePayer: feePayer.publicKey,
      proposalId: proposal.proposalId,
      timestamp,
      clientDataJSON,
      signature,
      guardianWebAuthnPubkey
    });
    
    // 8. Tạo và ký transaction
    const transaction = new Transaction();
    transaction.add(approveInstruction);
    
    // Lấy recent blockhash và thiết lập fee payer
    transaction.recentBlockhash = (await connection.getLatestBlockhash('confirmed')).blockhash;
    transaction.feePayer = feePayer.publicKey;
    
    // Ký transaction
    transaction.sign(feePayer);
    
    // 9. Gửi transaction lên blockchain
    const serializedTx = transaction.serialize();
    const txSignature = await connection.sendRawTransaction(serializedTx, {
      skipPreflight: false,
      maxRetries: 3,
      preflightCommitment: 'confirmed'
    });
    
    console.log("Đã gửi transaction ký đề xuất:", txSignature);
    
    // 10. Cập nhật danh sách người ký trong Firebase
    await updateProposalSigners(proposal, actualGuardianId, txSignature);
    
    return txSignature;
  } catch (error) {
    console.error("Lỗi trong quá trình ký đề xuất:", error);
    throw error;
  }
}

/**
 * Chuẩn hóa chữ ký về dạng Low-S
 */
export const normalizeSignatureToLowS = (signature: Buffer): Buffer => {
  // Cách mới, sử dụng Buffer.subarray thay vì slice
  const rBytes = Buffer.from(signature.subarray(0, 32));
  const sBytes = Buffer.from(signature.subarray(32, 64));
  
  // Chuyển s thành BN để so sánh với HALF_ORDER
  const sBN = new BN(sBytes);
  
  // Kiểm tra nếu s > half_order
  if (sBN.gt(SECP256R1_HALF_ORDER)) {
    // Tính s' = order - s
    const sNormalized = SECP256R1_ORDER.sub(sBN);
    const sNormalizedBuffer = sNormalized.toArrayLike(Buffer, 'be', 32);
    return Buffer.concat([rBytes, sNormalizedBuffer]);
  }
  
  return signature;
}; 