import { Keypair } from "@solana/web3.js";

/**
 * Chuyển đổi chuỗi secret key từ .env thành Uint8Array
 */
export const convertSecretKeyToUint8Array = (
  secretKeyString: string | undefined,
): Uint8Array => {
  if (!secretKeyString) {
    console.warn("Secret key không được định nghĩa");
    return new Uint8Array(64);
  }

  try {
    // Chuyển đổi chuỗi "1,2,3,..." thành mảng số
    const numbers = secretKeyString
      .split(",")
      .map((s) => parseInt(s.trim(), 10));

    // Kiểm tra kích thước hợp lệ (64 bytes cho ed25519)
    if (numbers.length !== 64) {
      console.warn(
        `Secret key phải có 64 bytes, nhưng có ${numbers.length} bytes`,
      );
      return new Uint8Array(64);
    }

    return new Uint8Array(numbers);
  } catch (error) {
    console.error("Lỗi khi chuyển đổi secret key:", error);
    return new Uint8Array(64);
  }
};

/**
 * Tạo feePayer keypair từ biến môi trường hoặc tạo mới nếu không có
 */
export const createFeePayerKeypair = (): Keypair => {
  try {
    const secretKeyString = process.env.NEXT_PUBLIC_FEE_PAYER_SECRET_KEY;
    if (!secretKeyString) {
      console.log("Không tìm thấy FEE_PAYER_SECRET_KEY, tạo feePayer mới");
      return Keypair.generate();
    }

    return Keypair.fromSecretKey(convertSecretKeyToUint8Array(secretKeyString));
  } catch (error) {
    console.error("Lỗi khi tạo fee payer keypair:", error);
    return Keypair.generate();
  }
};

/**
 * Lấy feePayer publicKey dưới dạng chuỗi
 */
export const getFeePayerPublicKeyString = (): string => {
  try {
    const feePayer = createFeePayerKeypair();
    return feePayer.publicKey.toString();
  } catch (error) {
    console.error("Lỗi khi lấy feePayer public key:", error);
    return "";
  }
};
