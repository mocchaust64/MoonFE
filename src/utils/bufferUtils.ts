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
  // Đảm bảo khóa bắt đầu với byte 0x04 (không nén)
  if (uncompressedKey[0] !== 0x04 || uncompressedKey.length !== 65) {
    console.warn(
      "Khóa không đúng định dạng không nén ECDSA, tạo khóa ngẫu nhiên",
    );
    // Tạo khóa random nếu không đúng định dạng
    const randomKey = Buffer.alloc(33);
    randomKey[0] = 0x02; // compressed, y is even

    // Tạo dữ liệu ngẫu nhiên cho 32 bytes còn lại
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);

    // Sao chép vào buffer
    for (let i = 0; i < 32; i++) {
      randomKey[i + 1] = randomBytes[i];
    }

    return randomKey;
  }

  // Lấy tọa độ x và y
  const x = new Uint8Array(uncompressedKey.slice(1, 33));
  const y = new Uint8Array(uncompressedKey.slice(33, 65));

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
