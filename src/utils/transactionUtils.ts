/**
 * @file transactionUtils.ts
 * @description Tiện ích xử lý transaction trên Solana
 */
import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";
import { sha256 } from "@noble/hashes/sha256";

// Constants
export const PROGRAM_ID = new PublicKey("5tFJskbgqrPxb992SUf6JzcQWJGbJuvsta2pRnZBcygN");
export const SECP256R1_PROGRAM_ID = new PublicKey("Secp256r1SigVerify1111111111111111111111111");
export const SYSVAR_INSTRUCTIONS_PUBKEY = new PublicKey("Sysvar1nstructions1111111111111111111111111");
export const SYSVAR_CLOCK_PUBKEY = new PublicKey("SysvarC1ock11111111111111111111111111111111");

/**
 * Hàm tạo transaction để ký phê duyệt một đề xuất
 */
export const createApproveProposalTx = async (
  proposalPDA: PublicKey,
  multisigPDA: PublicKey,
  guardianPDA: PublicKey,
  guardianId: number,
  payer: PublicKey,
  webauthnSignature: Uint8Array,
  authenticatorData: Uint8Array,
  clientDataJSON: Uint8Array,
  proposalId: string | number,
  timestamp: number,
  credentialId?: string
): Promise<Transaction> => {
  // Tạo transaction mới
  const transaction = new Transaction();

  // Lấy WebAuthn public key từ credential, truyền credentialId nếu có
  console.log("Đang tìm WebAuthn public key...");
  const webAuthnPubKey = await getWebAuthnPublicKey(guardianPDA, credentialId);
  
  if (!webAuthnPubKey) {
    throw new Error("Không tìm thấy WebAuthn public key cho guardian này");
  }
  
  console.log("==== DEBUG WEBAUTHN PUBLIC KEY IN TRANSACTION ====");
  console.log("WebAuthn Public Key (Hex):", webAuthnPubKey.toString('hex'));
  console.log("WebAuthn Public Key length:", webAuthnPubKey.length);
  console.log("WebAuthn Public Key bytes:", Array.from(webAuthnPubKey));
  console.log("===============================================");
  
  // Tính hash của WebAuthn public key sử dụng hàm sha256
  console.log("Sử dụng sha256 để tính hash của webAuthnPubKey:", {
    type: typeof webAuthnPubKey,
    length: webAuthnPubKey.length,
    bytes: Array.from(webAuthnPubKey).slice(0, 5)
  });
  
  const hashBytes = sha256(webAuthnPubKey);
  
  console.log("Kết quả hash:", {
    type: typeof hashBytes,
    length: hashBytes.length,
    bytes: Array.from(hashBytes).slice(0, 10)
  });
  
  // Lấy 6 bytes đầu tiên
  const pubkeyHashBytes = hashBytes.slice(0, 6);
  console.log("6 bytes đầu:", Array.from(pubkeyHashBytes));
  
  // Chuyển đổi sang hex string
  const pubkeyHashHex = Array.from(pubkeyHashBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
    
  console.log("pubkeyHashHex cuối cùng:", pubkeyHashHex);

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
  
  // 6. Tạo instruction Secp256r1 để xác thực chữ ký
  const secp256r1Ix = createSecp256r1Instruction(
    Buffer.from(verificationData),
    webAuthnPubKey,
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
  
  // 8. Tạo danh sách account cần thiết
  const approveIx = new TransactionInstruction({
    keys: [
      { pubkey: multisigPDA, isSigner: false, isWritable: true }, // Thay đổi isWritable thành true
      { pubkey: proposalPDA, isSigner: false, isWritable: true },
      // Danh sách tài khoản signature sẽ được tạo PDA từ proposal và guardianId
      { pubkey: await findSignaturePDA(proposalPDA, guardianId), isSigner: false, isWritable: true },
      { pubkey: guardianPDA, isSigner: false, isWritable: false },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: approveData
  });
  
  // Thêm approve instruction vào transaction
  transaction.add(approveIx);
  
  return transaction;
};

/**
 * Hàm hỗ trợ để tìm PDA cho signature từ proposal và guardianId
 */
async function findSignaturePDA(proposalPDA: PublicKey, guardianId: number): Promise<PublicKey> {
  const [pda] = await PublicKey.findProgramAddress(
    [
      Buffer.from("signature"),
      proposalPDA.toBuffer(),
      new BN(guardianId).toArrayLike(Buffer, "le", 8)
    ],
    PROGRAM_ID
  );
  return pda;
}

/**
 * Hàm hỗ trợ để lấy WebAuthn public key cho guardian
 * @param guardianPDA PublicKey của guardian
 * @param overrideCredentialId Credential ID tùy chọn để ghi đè ID từ localStorage
 */
async function getWebAuthnPublicKey(guardianPDA: PublicKey, overrideCredentialId?: string): Promise<Buffer> {
  console.log("Tìm WebAuthn public key cho guardian:", guardianPDA.toString());
  
  let credentialId: string;
  let normalizedCredentialId: string;
  
  if (overrideCredentialId) {
    // Sử dụng credential ID được chỉ định
    credentialId = overrideCredentialId;
    console.log("Sử dụng credential ID được chỉ định:", credentialId);
  } else {
    // Kiểm tra xem có credential ID trong localStorage không
    const userCredentials = JSON.parse(localStorage.getItem("userCredentials") || "[]");
    if (userCredentials.length === 0) {
      throw new Error("Không tìm thấy thông tin đăng nhập WebAuthn. Vui lòng đăng nhập trước.");
    }
    
    credentialId = userCredentials[0].id;
    console.log("Sử dụng credential ID từ userCredentials:", credentialId);
  }
  
  // Chuẩn hóa credential ID
  normalizedCredentialId = normalizeCredentialId(credentialId);
  console.log("Normalized credential ID:", normalizedCredentialId);
  
  // Lấy public key theo credential ID cụ thể
  const credentialSpecificKey = `guardianPublicKey_${normalizedCredentialId}`;
  const publicKeyHex = localStorage.getItem(credentialSpecificKey);
  
  if (!publicKeyHex) {
    throw new Error(`Không tìm thấy public key cho credential ID: ${credentialId}. Khóa '${credentialSpecificKey}' không tồn tại trong localStorage.`);
  }
  
  console.log("Đã tìm thấy public key trong localStorage theo credential ID:", publicKeyHex.slice(0, 10) + "...");
  const pubKeyBuffer = Buffer.from(publicKeyHex, 'hex');
  console.log("Độ dài public key:", pubKeyBuffer.length);
  
  if (pubKeyBuffer.length !== 33 && pubKeyBuffer.length !== 65) {
    throw new Error(`Public key không đúng định dạng: độ dài ${pubKeyBuffer.length} bytes, cần 33 hoặc 65 bytes.`);
  }
  
  return pubKeyBuffer;
}

/**
 * Chuẩn hóa credential ID
 */
const normalizeCredentialId = (credId: string): string => {
  // Đảm bảo credId là base64
  try {
    const buffer = Buffer.from(credId, 'base64');
    return buffer.toString('hex');
  } catch (e) {
    // Nếu đã là hex, trả về nguyên
    return credId;
  }
};

/**
 * Tạo transaction để thực thi một đề xuất giao dịch đã được phê duyệt
 */
export const createExecuteProposalTx = async (
  proposalPDA: PublicKey,
  multisigPDA: PublicKey,
  feePayer: PublicKey,
  destination?: PublicKey
): Promise<Transaction> => {
  // Tạo transaction mới
  const transaction = new Transaction();

  // Tạo discriminator cho execute_proposal
  const executeProposalDiscriminator = Buffer.from([186, 60, 116, 133, 108, 128, 111, 28]); // Discriminator chính xác từ IDL
  
  console.log('Execute Proposal Discriminator (hex):', Buffer.from(executeProposalDiscriminator).toString('hex'));
  
  // Tạo dữ liệu cho proposal_id
  const proposalIdMatch = proposalPDA.toString().match(/proposal-(\d+)/);
  const proposalId = proposalIdMatch ? parseInt(proposalIdMatch[1]) : 1; // Lấy ID từ tên PDA hoặc mặc định là 1
  
  const proposalIdBuffer = Buffer.alloc(8);
  proposalIdBuffer.writeBigUInt64LE(BigInt(proposalId), 0);
  
  // Tạo dữ liệu instruction
  const executeData = Buffer.concat([
    executeProposalDiscriminator,
    proposalIdBuffer,
  ]);
  
  // Tạo danh sách account cần thiết
  const accounts = [
    { pubkey: multisigPDA, isSigner: false, isWritable: true },
    { pubkey: proposalPDA, isSigner: false, isWritable: true },
    { pubkey: feePayer, isSigner: true, isWritable: true },
  ];
  
  // Thêm destination nếu được cung cấp
  if (destination) {
    accounts.push({ pubkey: destination, isSigner: false, isWritable: true });
  }
  
  // Thêm các account hệ thống
  accounts.push(
    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
  );
  
  console.log("Executing with accounts:", accounts.map((acc, index) => `${index}: ${acc.pubkey.toBase58()}`));
  
  // Tạo instruction
  const executeIx = new TransactionInstruction({
    keys: accounts,
    programId: PROGRAM_ID,
    data: executeData
  });
  
  // Thêm instruction vào transaction
  transaction.add(executeIx);
  
  return transaction;
};

/**
 * Tạo instruction Secp256r1
 */
export const createSecp256r1Instruction = (
  message: Buffer, 
  publicKey: Buffer,
  signature: Buffer,
  shouldFlipPublicKey: boolean = false
): TransactionInstruction => {
  // Tạo public key mới nếu cần flip
  const finalPublicKey = shouldFlipPublicKey 
    ? flipEndianness(publicKey) 
    : publicKey;
  
  // Tạo dữ liệu instruction
  const data = Buffer.concat([
    finalPublicKey,
    message,
    signature
  ]);
  
  // Tạo instruction cho chương trình Secp256r1
  return new TransactionInstruction({
    keys: [],
    programId: SECP256R1_PROGRAM_ID,
    data: data
  });
};

/**
 * Chuyển đổi signature DER sang định dạng Raw (r || s)
 */
export const derToRaw = (derSignature: Uint8Array): Uint8Array => {
  const derSequence = derSignature[0];
  if (derSequence !== 0x30) {
    throw new Error("DER signature không bắt đầu với 0x30");
  }
  
  // Lấy độ dài tổng thể
  const totalLength = derSignature[1];
  
  // Lấy r
  const rType = derSignature[2];
  if (rType !== 0x02) {
    throw new Error("R không phải integer (0x02)");
  }
  
  const rLength = derSignature[3];
  let rOffset = 4;
  let rValue = derSignature.slice(rOffset, rOffset + rLength);
  
  // Loại bỏ padding 0 nếu có
  if (rValue[0] === 0x00 && rValue.length > 32) {
    rValue = rValue.slice(1);
  }
  
  // Padding để đủ 32 bytes
  if (rValue.length < 32) {
    const tmp = new Uint8Array(32);
    tmp.set(rValue, 32 - rValue.length);
    rValue = tmp;
  }
  
  // Lấy s
  const sOffset = rOffset + rLength;
  const sType = derSignature[sOffset];
  if (sType !== 0x02) {
    throw new Error("S không phải integer (0x02)");
  }
  
  const sLength = derSignature[sOffset + 1];
  let sValue = derSignature.slice(sOffset + 2, sOffset + 2 + sLength);
  
  // Loại bỏ padding 0 nếu có
  if (sValue[0] === 0x00 && sValue.length > 32) {
    sValue = sValue.slice(1);
  }
  
  // Padding để đủ 32 bytes
  if (sValue.length < 32) {
    const tmp = new Uint8Array(32);
    tmp.set(sValue, 32 - sValue.length);
    sValue = tmp;
  }
  
  // Trả về r || s
  const rawSignature = new Uint8Array(64);
  rawSignature.set(rValue, 0);
  rawSignature.set(sValue, 32);
  
  return rawSignature;
};

/**
 * Hàm chuẩn hóa signature về dạng Low-S
 */
export const normalizeSignatureToLowS = (signature: Buffer): Buffer => {
  // Secp256r1 curve order
  const curveOrder = Buffer.from('FFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551', 'hex');
  const curveOrderBN = new BN(curveOrder);
  const halfCurveOrder = curveOrderBN.div(new BN(2));
  
  // Tách signature thành r và s
  const r = signature.slice(0, 32);
  const s = signature.slice(32, 64);
  
  // Chuyển s thành BN
  const sBN = new BN(s);
  
  // Kiểm tra nếu s > half curve order, thì s = curve order - s
  if (sBN.gt(halfCurveOrder)) {
    const newSBN = curveOrderBN.sub(sBN);
    const newS = newSBN.toArrayLike(Buffer, 'be', 32);
    
    // Tạo signature mới
    const normalizedSignature = Buffer.alloc(64);
    r.copy(normalizedSignature, 0);
    newS.copy(normalizedSignature, 32);
    
    return normalizedSignature;
  }
  
  // Nếu s đã ở dạng low-S, trả về nguyên bản
  return signature;
};

/**
 * Hàm hỗ trợ đảo ngược endianness của buffer (Big-endian <-> Little-endian)
 */
function flipEndianness(buffer: Buffer): Buffer {
  const result = Buffer.alloc(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    result[i] = buffer[buffer.length - 1 - i];
  }
  return result;
}

/**
 * Hàm tính toán SHA-256 hash của dữ liệu
 */
async function calculateSha256(data: Buffer): Promise<Uint8Array> {
  const arrayBuffer = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(arrayBuffer);
} 