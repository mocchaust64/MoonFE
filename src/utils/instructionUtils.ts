import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import BN from 'bn.js';

// Định nghĩa PROGRAM_ID cho secp256r1
export const SECP256R1_PROGRAM_ID = new PublicKey('Secp256r1SigVerify1111111111111111111111111');

// Các hằng số cho việc chuẩn hóa chữ ký secp256r1
// Thứ tự của curve (n) từ NIST P-256 / secp256r1
export const SECP256R1_ORDER = new BN('FFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551', 16);
// Nửa thứ tự curve (để kiểm tra Low-S)
export const SECP256R1_HALF_ORDER = SECP256R1_ORDER.shrn(1);

/**
 * Tạo instruction Secp256r1 với cấu trúc dữ liệu chính xác
 * Quan trọng: Định dạng dữ liệu phải chính xác theo yêu cầu của chương trình Secp256r1
 * Format: [num_signatures=1(u8), unused(u8), signature_offset(u16), signature_instruction_index(u16),
 *          public_key_offset(u16), public_key_instruction_index(u16), message_offset(u16),
 *          message_size(u16), message_instruction_index(u16), 
 *          publicKey(33 bytes), signature(64 bytes), message(variable)]
 */
export const createSecp256r1Instruction = (
  message: Buffer, 
  publicKey: Buffer,
  signature: Buffer,
  shouldFlipPublicKey: boolean = false
): TransactionInstruction => {
  console.log("Tạo secp256r1 instruction với:");
  console.log("- Message (" + message.length + " bytes):", message.slice(0, 20).toString('hex') + "...");
  console.log("- Public key (" + publicKey.length + " bytes):", publicKey.toString('hex'));
  console.log("- Signature (" + signature.length + " bytes):", signature.toString('hex'));
  console.log("- Flip public key:", shouldFlipPublicKey);

  // Đảm bảo public key có định dạng đúng (33 bytes)
  let processedPublicKey = publicKey;
  if (publicKey.length === 32) {
    console.log("Public key thiếu byte đầu (chỉ có 32 bytes), thêm byte 0x02 để nén thành 33 bytes");
    processedPublicKey = Buffer.concat([Buffer.from([0x02]), publicKey]);
  } else if (publicKey.length !== 33 && publicKey.length !== 65) {
    throw new Error(`Public key có độ dài không hợp lệ: ${publicKey.length} bytes (cần 33 hoặc 65 bytes)`);
  }

  // Tạo public key mới nếu cần flip
  const finalPublicKey = shouldFlipPublicKey 
    ? flipEndianness(processedPublicKey) 
    : processedPublicKey;

  // Đảm bảo signature có độ dài 64 bytes
  let finalSignature = signature;
  if (signature.length !== 64) {
    console.log(`Signature không phải 64 bytes, độ dài hiện tại: ${signature.length}`);
    
    if (signature.length > 70 && signature[0] === 0x30) {
      console.log("Phát hiện signature định dạng DER, chuyển đổi sang raw format");
      finalSignature = derToRaw(signature);
      console.log(`Đã chuyển đổi thành công từ DER sang raw format, độ dài mới: ${finalSignature.length}`);
    } else {
      throw new Error(`Signature không đúng định dạng raw hoặc DER: ${signature.length} bytes`);
    }
  }

  // Chuẩn hóa signature về dạng Low-S
  console.log("Chuẩn hóa signature về dạng Low-S...");
  const normalizedSignature = normalizeSignatureToLowS(finalSignature);

  // Xây dựng cấu trúc dữ liệu cho instruction secp256r1
  // Instruction cấu trúc hoàn chỉnh
  const numSignatures = 1; // Chỉ một chữ ký
  const unusedByte = 0; // Không sử dụng, giữ 0
  const sigOffset = 16 + finalPublicKey.length; // offset tới signature
  const sigIx = 0; // Chỉ số của instruction chứa signature
  const pubkeyOffset = 16; // offset tới public key
  const pubkeyIx = 0; // Chỉ số của instruction chứa public key
  const msgOffset = 16 + finalPublicKey.length + normalizedSignature.length; // offset tới message
  const msgSize = message.length; // kích thước message
  const msgIx = 0; // Chỉ số của instruction chứa message

  // Tạo phần header
  const header = Buffer.alloc(16);
  header.writeUInt8(numSignatures, 0); // 1 signature
  header.writeUInt8(unusedByte, 1); // unused
  header.writeUInt16LE(sigOffset, 2); // signature offset
  header.writeUInt16LE(sigIx, 4); // signature instruction index
  header.writeUInt16LE(pubkeyOffset, 6); // public key offset
  header.writeUInt16LE(pubkeyIx, 8); // public key instruction index
  header.writeUInt16LE(msgOffset, 10); // message offset
  header.writeUInt16LE(msgSize, 12); // message size
  header.writeUInt16LE(msgIx, 14); // message instruction index

  // In thông tin debug
  console.log("Secp256r1 instruction data:");
  console.log("- Total size:", 16 + finalPublicKey.length + normalizedSignature.length + message.length);
  console.log("- Public key offset:", pubkeyOffset);
  console.log("- Signature offset:", sigOffset);
  console.log("- Message offset:", msgOffset);
  console.log("- Message size:", msgSize);

  // Tạo dữ liệu instruction
  const data = Buffer.concat([
    header,
    finalPublicKey,
    normalizedSignature,
    message
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
export const derToRaw = (derSignature: Buffer | Uint8Array): Buffer => {
  console.log("Xử lý chữ ký DER, độ dài:", derSignature.length, "bytes");
  const derHex = Buffer.from(derSignature).toString('hex');
  console.log("DER signature (hex):", derHex);
  
  const derSequence = derSignature[0];
  if (derSequence !== 0x30) {
    throw new Error("DER signature không bắt đầu với 0x30");
  }
  
  let rLength, rOffset, sLength, sOffset;
  
  // Xử lý DER format: 0x30 [total-length] 0x02 [r-length] [r] 0x02 [s-length] [s]
  try {
    rLength = derSignature[3];
    rOffset = 4;
    let rValue = Buffer.from(derSignature.slice(rOffset, rOffset + rLength));
    
    sOffset = rOffset + rLength + 2; // +2 for 0x02 and length byte
    if (derSignature[rOffset + rLength] !== 0x02) {
      throw new Error("Không tìm thấy phần tử marker 0x02 cho s trong signature DER");
    }
    
    sLength = derSignature[rOffset + rLength + 1];
    let sValue = Buffer.from(derSignature.slice(sOffset, sOffset + sLength));
    
    console.log("DER r length:", rValue.length, "r (hex):", rValue.toString('hex'));
    console.log("DER s length:", sValue.length, "s (hex):", sValue.toString('hex'));
    
    // Xử lý trường hợp r có 33 bytes với byte đầu tiên là 0x00
    if (rValue.length === 33 && rValue[0] === 0x00) {
      console.log("Phát hiện r dài 33 bytes với byte đầu 0x00, loại bỏ byte này");
      rValue = rValue.slice(1);
    }
    
    // Xử lý trường hợp s có 33 bytes với byte đầu tiên là 0x00
    if (sValue.length === 33 && sValue[0] === 0x00) {
      console.log("Phát hiện s dài 33 bytes với byte đầu 0x00, loại bỏ byte này");
      sValue = sValue.slice(1);
    }
    
    // Chuẩn bị r và s cho định dạng raw (mỗi phần 32 bytes)
    const rPadded = Buffer.alloc(32);
    const sPadded = Buffer.alloc(32);
    
    if (rValue.length <= 32) {
      // Trường hợp r ngắn hơn 32 bytes, thêm padding
      rValue.copy(rPadded, 32 - rValue.length);
    } else {
      // Trường hợp r dài hơn 32 bytes, lấy 32 bytes cuối
      rValue.copy(rPadded, 0, rValue.length - 32);
    }
    
    if (sValue.length <= 32) {
      // Trường hợp s ngắn hơn 32 bytes, thêm padding
      sValue.copy(sPadded, 32 - sValue.length);
    } else {
      // Trường hợp s dài hơn 32 bytes, lấy 32 bytes cuối
      sValue.copy(sPadded, 0, sValue.length - 32);
    }
    
    // Nối r và s lại
    const rawSignature = Buffer.concat([rPadded, sPadded]);
    
    console.log("Raw signature (r||s):", rawSignature.toString('hex'));
    console.log("Raw signature length:", rawSignature.length);
    
    return rawSignature;
  } catch (error) {
    console.error("Lỗi khi xử lý signature DER:", error);
    throw error;
  }
};

/**
 * Hàm chuẩn hóa signature về dạng Low-S
 * Quan trọng: Secp256r1 yêu cầu signatures ở dạng Low-S
 */
export const normalizeSignatureToLowS = (signature: Buffer): Buffer => {
  // Hằng số cho secp256r1
  const SECP256R1_ORDER = new BN('FFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551', 16);
  const SECP256R1_HALF_ORDER = SECP256R1_ORDER.div(new BN(2));
  
  console.log("Kiểm tra nếu signature cần chuẩn hóa Low-S");
  // Tách signature thành r và s
  const r = signature.slice(0, 32);
  const s = signature.slice(32, 64);
  
  console.log("r (32 bytes):", r.toString('hex'));
  console.log("s (32 bytes):", s.toString('hex'));
  
  // Chuyển s thành BN
  const sBN = new BN(s);
  
  // Kiểm tra nếu s > half curve order, thì s = curve order - s
  if (sBN.gt(SECP256R1_HALF_ORDER)) {
    console.log("S > HALF_ORDER, cần chuẩn hóa signature về dạng Low-S");
    const newSBN = SECP256R1_ORDER.sub(sBN);
    const newS = newSBN.toArrayLike(Buffer, 'be', 32);
    console.log("s sau khi chuẩn hóa:", newS.toString('hex'));
    
    // Tạo signature mới
    const normalizedSignature = Buffer.alloc(64);
    r.copy(normalizedSignature, 0);
    newS.copy(normalizedSignature, 32);
    
    return normalizedSignature;
  }
  
  // Nếu s đã ở dạng low-S, trả về nguyên bản
  console.log("Signature đã ở dạng Low-S");
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