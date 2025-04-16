import { getFirestore } from 'firebase/firestore';
import { PublicKey, Transaction, TransactionInstruction, Connection, SystemProgram, SYSVAR_INSTRUCTIONS_PUBKEY, SYSVAR_CLOCK_PUBKEY } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { sha256 } from '@noble/hashes/sha256';
import { getWalletByCredentialId } from '../lib/firebase/webAuthnService';
import { getGuardianPDA } from './credentialUtils';
import { addSignerToProposal, updateProposalStatus } from '../lib/firebase/proposalService';
import { PROGRAM_ID } from './constants';
import { compressPublicKey } from './bufferUtils';
import { Keypair } from '@solana/web3.js';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { createSecp256r1Instruction } from '../lib/solana/secp256r1';
import { Proposal } from '../lib/firebase/proposalService';
import { program } from '../lib/solana';

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
      const { getProposalById } = await import('../lib/firebase/proposalService');
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
 * Lấy thông tin WebAuthn public key của guardian theo multisigAddress và guardianId
 * @param multisigPDA Địa chỉ ví multisig
 * @param guardianId ID của guardian
 * @returns Public key của guardian (dạng Uint8Array)
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
    
    // Kiểm tra thông tin trong localStorage trước
    const storedCredentialId = localStorage.getItem('current_credential_id');
    if (storedCredentialId) {
      const localStorageKey = "webauthn_credential_" + storedCredentialId;
      const localMapping = localStorage.getItem(localStorageKey);
      
      if (localMapping) {
        try {
          const mappingData = JSON.parse(localMapping);
          console.log("Thông tin WebAuthn từ localStorage:", {
            credentialId: storedCredentialId,
            guardianId: mappingData.guardianId,
            walletAddress: mappingData.walletAddress
          });
          
          // Kiểm tra nếu mapping có guardianId và khớp với ví multisig
          if (mappingData.guardianPublicKey && 
              mappingData.walletAddress === multisigAddress) {
            
            // Nếu guardianId từ mapping khác với guardianId truyền vào, ưu tiên dùng guardianId từ mapping
            if (mappingData.guardianId !== guardianId) {
              console.warn(`QUAN TRỌNG: GuardianId từ localStorage (${mappingData.guardianId}) khác với guardianId truyền vào (${guardianId}). Sử dụng guardianId từ localStorage!`);
              // Cập nhật lại guardianId trong localStorage
              localStorage.setItem('current_guardian_id', mappingData.guardianId.toString());
            }
            
            console.log("Sử dụng thông tin guardian từ localStorage");
            const publicKeyArray = Array.isArray(mappingData.guardianPublicKey) 
              ? new Uint8Array(mappingData.guardianPublicKey)
              : mappingData.guardianPublicKey;
              
            // Log chi tiết về key
            console.log("=========== PUBLIC KEY DEBUG INFO ===========");
            console.log("WebAuthn Public Key length:", publicKeyArray.length);
            console.log("WebAuthn Public Key format:", publicKeyArray[0] === 2 ? "Compressed (0x2)" : 
                                                   publicKeyArray[0] === 3 ? "Compressed (0x3)" : 
                                                   publicKeyArray[0] === 4 ? "Uncompressed (0x4)" : "Unknown");
            console.log("WebAuthn Public Key hex:", Buffer.from(publicKeyArray).toString('hex'));
            console.log("=========================================");
            
            return publicKeyArray;
          }
        } catch (e) {
          console.error("Lỗi khi parse thông tin credential từ localStorage:", e);
        }
      }
    }
    
    // Nếu không tìm thấy trong localStorage, truy vấn từ Firebase
    try {
      const { getWalletByCredentialId, getCredentialsByWallet } = await import("@/lib/firebase/webAuthnService");
      
      // Nếu có credential ID, ưu tiên tìm theo credential ID
      if (storedCredentialId) {
        console.log("Tìm guardian theo credential ID:", storedCredentialId);
        const normalizedCredentialId = await (await import("@/lib/firebase/webAuthnService")).normalizeCredentialId(storedCredentialId);
        const credentialData = await getWalletByCredentialId(normalizedCredentialId);
        
        if (credentialData && 
            credentialData.walletAddress === multisigAddress && 
            Array.isArray(credentialData.guardianPublicKey)) {
          
          console.log("Tìm thấy mapping theo credential ID:", {
            guardianId: credentialData.guardianId,
            walletAddress: credentialData.walletAddress
          });
          
          // Nếu guardianId từ Firebase khác với guardianId truyền vào, ưu tiên dùng từ Firebase
          if (credentialData.guardianId !== guardianId) {
            console.warn(`QUAN TRỌNG: GuardianId từ Firebase (${credentialData.guardianId}) khác với guardianId truyền vào (${guardianId}). Sử dụng guardianId từ Firebase!`);
            // Cập nhật lại guardianId trong localStorage
            localStorage.setItem('current_guardian_id', credentialData.guardianId.toString());
          }
          
          const publicKeyArray = new Uint8Array(credentialData.guardianPublicKey);
          
          // Log chi tiết về key
          console.log("=========== PUBLIC KEY DEBUG INFO ===========");
          console.log("WebAuthn Public Key length:", publicKeyArray.length);
          console.log("WebAuthn Public Key format:", publicKeyArray[0] === 2 ? "Compressed (0x2)" : 
                                                publicKeyArray[0] === 3 ? "Compressed (0x3)" : 
                                                publicKeyArray[0] === 4 ? "Uncompressed (0x4)" : "Unknown");
          console.log("WebAuthn Public Key hex:", Buffer.from(publicKeyArray).toString('hex'));
          console.log("=========================================");
          
          return publicKeyArray;
        }
      }
      
      // Nếu không tìm thấy theo credential ID, tìm theo multisigPDA và guardianId
      console.log("Tìm guardian theo multisig và guardian ID:", multisigAddress, guardianId);
      const credentials = await getCredentialsByWallet(multisigAddress);
      
      // Tìm guardian phù hợp với guardianId
      const guardianCredential = credentials.find(cred => cred.guardianId === guardianId);
      
      if (guardianCredential && Array.isArray(guardianCredential.guardianPublicKey)) {
        console.log("Tìm thấy guardian theo multisig và guardian ID:", {
          guardianId: guardianCredential.guardianId,
          credentialId: guardianCredential.credentialId,
        });
        
        const publicKeyArray = new Uint8Array(guardianCredential.guardianPublicKey);
        
        // Log chi tiết về key
        console.log("=========== PUBLIC KEY DEBUG INFO ===========");
        console.log("WebAuthn Public Key length:", publicKeyArray.length);
        console.log("WebAuthn Public Key format:", publicKeyArray[0] === 2 ? "Compressed (0x2)" : 
                                               publicKeyArray[0] === 3 ? "Compressed (0x3)" : 
                                               publicKeyArray[0] === 4 ? "Uncompressed (0x4)" : "Unknown");
        console.log("WebAuthn Public Key hex:", Buffer.from(publicKeyArray).toString('hex'));
        console.log("=========================================");
        
        // Cập nhật localStorage để lần sau nhanh hơn
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
        
        return publicKeyArray;
      }
      
      // Nếu không tìm thấy guardian nào khớp
      console.error(`Không tìm thấy guardian với ID ${guardianId} cho ví ${multisigAddress}`);
      console.error("Danh sách guardians tìm thấy:", credentials.map(c => ({ id: c.guardianId, credentialId: c.credentialId })));
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
    // Lấy guardianId từ localStorage nếu không được cung cấp
    let actualGuardianId = guardianId;
    if (actualGuardianId === undefined) {
      console.log("guardianId không được cung cấp, lấy từ localStorage...");
      const storedGuardianId = localStorage.getItem("current_guardian_id");
      
      if (!storedGuardianId) {
        console.error("Không tìm thấy guardian ID trong localStorage");
        throw new Error("Không tìm thấy guardian ID, không thể ký đề xuất");
      }
      
      actualGuardianId = parseInt(storedGuardianId);
      console.log("Đã lấy guardianId từ localStorage:", actualGuardianId);
    } else {
      console.log("Sử dụng guardianId được truyền vào:", actualGuardianId);
    }
    
    console.log("Guardian ID cuối cùng sử dụng:", actualGuardianId);
    
    // Lấy thông tin mapping từ localStorage trước khi truy vấn Firebase
    const storedCredentialId = localStorage.getItem("current_credential_id");
    if (storedCredentialId) {
      const localStorageKey = "webauthn_credential_" + storedCredentialId;
      const localMapping = localStorage.getItem(localStorageKey);
      
      if (localMapping) {
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
    }
    
    // Lấy WebAuthn public key của guardian từ Firebase
    const guardianWebAuthnPubkey = await getGuardianWebAuthnPublicKey(multisigPDA, actualGuardianId);
    
    if (!guardianWebAuthnPubkey) {
      throw new Error(`Không tìm thấy WebAuthn public key cho guardian ID ${actualGuardianId}`);
    }
    
    // Tính toán guardian PDA
    const [guardianPDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from("guardian"),
        multisigPDA.toBuffer(),
        new BN(actualGuardianId).toArrayLike(Buffer, "le", 8),
      ],
      PROGRAM_ID
    );
    
    console.log("Guardian PDA:", guardianPDA.toString());
    
    // Tính toán proposal PDA
    const [proposalPDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from("proposal"),
        multisigPDA.toBuffer(),
        new BN(proposal.proposalId).toArrayLike(Buffer, "le", 8),
      ],
      PROGRAM_ID
    );
    
    console.log("Proposal PDA:", proposalPDA.toString());
    
    // Tạo thông điệp cần ký
    const currentTimestamp = Math.floor(Date.now() / 1000);
    console.log("Current timestamp:", currentTimestamp);
    
    const messageToSign = Buffer.concat([
      new BN(proposal.proposalId).toArrayLike(Buffer, "le", 8),
      new BN(currentTimestamp).toArrayLike(Buffer, "le", 8),
    ]);
    
    // Tạo challenge và tùy chọn cho WebAuthn
    const challenge = messageToSign;
    
    // Lấy credential ID nếu không được cung cấp
    let actualCredentialId = credentialId;
    if (!actualCredentialId) {
      console.log("credentialId không được cung cấp, lấy từ localStorage...");
      const storedCredentialId = localStorage.getItem("current_credential_id");
      
      if (!storedCredentialId) {
        throw new Error("Không tìm thấy credential ID, không thể ký đề xuất");
      }
      
      actualCredentialId = storedCredentialId;
    }
    
    console.log("Đang sử dụng credentialId:", actualCredentialId);
    
    // Tạo tùy chọn cho WebAuthn
    const publicKeyCredentialRequestOptions = {
      challenge,
      timeout: 60000,
      rpId: window.location.hostname,
      userVerification: "preferred" as UserVerificationRequirement,
      allowCredentials: [
        {
          id: Uint8Array.from(
            atob(actualCredentialId),
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
    
    // Tạo instruction phê duyệt đề xuất bằng cách xây dựng instruction thủ công
    // Tạo dữ liệu cho approve_proposal instruction
    const approveProposalDiscriminator = Buffer.from([136, 108, 102, 85, 98, 114, 7, 147]); // Discriminator từ IDL

    // Tạo các buffer cho tham số
    const proposalIdBuffer = Buffer.alloc(8);
    proposalIdBuffer.writeBigUInt64LE(BigInt(proposal.proposalId), 0);

    const timestampBuffer = Buffer.alloc(8);
    timestampBuffer.writeBigInt64LE(BigInt(currentTimestamp), 0);

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
    const approveInstruction = new TransactionInstruction({
      keys: [
        { pubkey: multisigPDA, isSigner: false, isWritable: false },
        { pubkey: guardianPDA, isSigner: false, isWritable: false },
        { pubkey: proposalPDA, isSigner: false, isWritable: true },
        { pubkey: feePayer.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: approveData
    });

    // Thêm các tài khoản liên quan
    approveInstruction.keys = [
      { pubkey: multisigPDA, isSigner: false, isWritable: false },
      { pubkey: guardianPDA, isSigner: false, isWritable: false },
      { pubkey: proposalPDA, isSigner: false, isWritable: true },
      { pubkey: feePayer.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
    
    // Tạo và gửi transaction
    const transaction = new Transaction();
    transaction.add(approveInstruction);
    transaction.feePayer = feePayer.publicKey;
    
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    transaction.sign(feePayer);
    
    console.log("Đang gửi transaction...");
    const txSignature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    
    console.log("Transaction đã được gửi:", txSignature);
    
    // Chờ xác nhận
    await connection.confirmTransaction(txSignature, 'confirmed');
    console.log("Transaction đã được xác nhận");
    
    // Cập nhật trạng thái đề xuất trong Firebase
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