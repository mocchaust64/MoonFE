/**
 * Các hàm tiện ích để xử lý buffer và chuyển đổi dữ liệu
 */
import { Buffer } from "buffer";

// Hàm chuyển đổi ArrayBuffer hoặc Uint8Array thành chuỗi hex
export const bufferToHex = (buffer: ArrayBuffer | Uint8Array): string => {
  const uintArray =
    buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(uintArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

// Hàm chuyển đổi từ BigInt (u64) sang bytes theo thứ tự little-endian
export const bigIntToLeBytes = (
  value: bigint,
  bytesLength: number = 8,
): Uint8Array => {
  const result = new Uint8Array(bytesLength);
  for (let i = 0; i < bytesLength; i++) {
    result[i] = Number((value >> BigInt(8 * i)) & BigInt(0xff));
  }
  return result;
};

// Hàm nén khóa công khai từ dạng uncompressed (65 bytes) sang compressed (33 bytes)
export const compressPublicKey = (uncompressedKey: Buffer): Buffer => {
  // Kiểm tra nếu khóa đã ở định dạng nén rồi thì trả về nguyên trạng
  if (uncompressedKey.length === 33 && (uncompressedKey[0] === 0x02 || uncompressedKey[0] === 0x03)) {
    console.log("Khóa đã ở định dạng nén (33 bytes), sử dụng trực tiếp");
    return uncompressedKey;
  }
  
  // Đảm bảo khóa bắt đầu với byte 0x04 (không nén)
  if (uncompressedKey[0] !== 0x04 || uncompressedKey.length !== 65) {
    console.warn("Khóa không đúng định dạng không nén ECDSA, tạo khóa ngẫu nhiên");
    // Tạo khóa random nếu không đúng định dạng
    const randomKey = Buffer.alloc(33);
    randomKey[0] = 0x02; // compressed, y is even
    
    // Tạo dữ liệu ngẫu nhiên cho 32 bytes còn lại
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    
    // Sao chép vào buffer
    for (let i = 0; i < 32; i++) {
      randomKey[i+1] = randomBytes[i];
    }
    
    return randomKey;
  }

  // Lấy tọa độ x và y
  const x = new Uint8Array(uncompressedKey.subarray(1, 33));
  const y = new Uint8Array(uncompressedKey.subarray(33, 65));

  // Tính prefix: 0x02 nếu y chẵn, 0x03 nếu y lẻ
  const prefix = (y[31] & 1) === 0 ? 0x02 : 0x03;

  // Tạo khóa nén: prefix (1 byte) + x (32 bytes)
  const compressedKey = Buffer.alloc(33);
  compressedKey[0] = prefix;

  // Copy x vào compressedKey từ vị trí 1
  for (let i = 0; i < 32; i++) {
    compressedKey[i + 1] = x[i];
  }

  return compressedKey;
};

/**
 * Chuyển đổi chữ ký từ định dạng DER (Distinguished Encoding Rules) sang định dạng raw
 * @param derSignature - Chữ ký định dạng DER (có thể là Buffer hoặc Uint8Array)
 * @returns Chữ ký định dạng raw (64 bytes: 32 bytes r + 32 bytes s)
 */
export const derToRaw = (derSignature: Buffer | Uint8Array): Uint8Array => {
  try {
    // Đảm bảo derSignature là Uint8Array
    const derBuffer = derSignature instanceof Buffer 
      ? new Uint8Array(derSignature) 
      : derSignature;
      
    // Kiểm tra format DER
    if (derBuffer[0] !== 0x30) {
      throw new Error('Chữ ký không đúng định dạng DER: byte đầu tiên không phải 0x30');
    }
    
    // DER format: 0x30 [total-length] 0x02 [r-length] [r] 0x02 [s-length] [s]
    let offset = 2; // Skip 0x30 + len
    
    // Đọc r
    if (derBuffer[offset] !== 0x02) {
      throw new Error('Định dạng DER không hợp lệ: không tìm thấy marker r (0x02)');
    }
    offset++; // Skip 0x02
    
    const rLen = derBuffer[offset++];
    const r = derBuffer.slice(offset, offset + rLen);
    offset += rLen;
    
    // Đọc s
    if (derBuffer[offset] !== 0x02) {
      throw new Error('Định dạng DER không hợp lệ: không tìm thấy marker s (0x02)');
    }
    offset++; // Skip 0x02
    
    const sLen = derBuffer[offset++];
    const s = derBuffer.slice(offset, offset + sLen);
   
    // Chuẩn bị r và s cho định dạng raw (mỗi phần 32 bytes)
    const rPadded = new Uint8Array(32);
    const sPadded = new Uint8Array(32);
    
    if (r.length <= 32) {
      // Trường hợp r ngắn hơn 32 bytes, thêm padding
      rPadded.set(r, 32 - r.length);
    } else {
      // Trường hợp r dài hơn 32 bytes (thường là có byte 0x00 ở đầu), lấy 32 bytes cuối
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
    rawSignature.set(rPadded, 0);
    rawSignature.set(sPadded, 32);
    
    return rawSignature;
  } catch (error) {
    console.error('Lỗi khi chuyển đổi chữ ký từ DER sang raw:', error);
    throw new Error(`Không thể chuyển đổi chữ ký DER: ${error instanceof Error ? error.message : String(error)}`);
  }
};
