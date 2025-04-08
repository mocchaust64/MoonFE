import { Keypair } from "@solana/web3.js";

export const convertSecretKeyStringToUint8Array = (
  secretKeyString: string | undefined,
): Uint8Array => {
  if (!secretKeyString) {
    throw new Error(
      "Fee payer secret key không được định nghĩa trong biến môi trường",
    );
  }

  const numbers = secretKeyString.split(",").map((s) => parseInt(s.trim(), 10));

  if (numbers.length !== 64 && numbers.length !== 65) {
    throw new Error(
      `Secret key phải có 64 hoặc 65 bytes, nhưng có ${numbers.length} bytes`,
    );
  }

  const bytes = numbers.length === 65 ? numbers.slice(0, 64) : numbers;
  return new Uint8Array(bytes);
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

    return Keypair.fromSecretKey(
      convertSecretKeyStringToUint8Array(secretKeyString),
    );
  } catch (error) {
    console.error("Lỗi khi tạo fee payer keypair:", error);
    return Keypair.generate();
  }
};
