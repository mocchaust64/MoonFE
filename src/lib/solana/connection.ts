import { Connection, PublicKey, Commitment } from "@solana/web3.js";

const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_RPC_ENDPOINT || "http://127.0.0.1:8899";
const PROGRAM_ID_STRING =
  process.env.NEXT_PUBLIC_PROGRAM_ID ||
  "BWzgXaQGxFk1ojzJ1Y2c91QTw7uF9zK9AJcGkdJA3VZt";

export const PROGRAM_ID = new PublicKey(PROGRAM_ID_STRING);

const connectionOptions = {
  commitment: "confirmed" as Commitment,
  confirmTransactionInitialTimeout: 60000,
  disableRetryOnRateLimit: false,
};

export const connection = new Connection(RPC_ENDPOINT, connectionOptions);

// Cluster API URL (Devnet) - dùng cho các kết nối mới khi cần
export const CLUSTER_API_URL = "https://api.devnet.solana.com";

// Seeds để tính PDA cho guardian
const GUARDIAN_SEED = "guardian";

/**
 * Chuyển đổi BigInt sang mảng byte little-endian
 */
export function bigIntToLeBytes(value: bigint): Uint8Array {
  const result = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    result[i] = Number((value >> BigInt(8 * i)) & BigInt(255));
  }
  return result;
}

/**
 * Tìm địa chỉ PDA của guardian dựa vào multisig address và guardian ID
 */
export async function findGuardianAddress(
  multisigAddress: PublicKey,
  guardianId: bigint,
): Promise<PublicKey | null> {
  try {
    // Chuyển đổi guardianId sang bytes (little-endian)
    const guardianIdBytes = bigIntToLeBytes(guardianId);

    // Tìm PDA cho guardian
    const [guardianPDA] = await PublicKey.findProgramAddressSync(
      [
        Buffer.from(GUARDIAN_SEED),
        multisigAddress.toBytes(),
        Buffer.from(guardianIdBytes),
      ],
      PROGRAM_ID,
    );

    return guardianPDA;
  } catch (error) {
    console.error(`Lỗi khi tính PDA cho guardian ID ${guardianId}:`, error);
    return null;
  }
}

/**
 * Tạo kết nối đến Solana cluster với các tùy chọn riêng
 * Lưu ý: Trong hầu hết các trường hợp nên sử dụng biến connection được export sẵn
 */
export function createConnection(): Connection {
  return new Connection(RPC_ENDPOINT, connectionOptions);
}
