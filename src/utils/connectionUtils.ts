import { Connection, Transaction } from "@solana/web3.js";
import { connection } from "@/lib/solana/index";

/**
 * Trả về connection đã cấu hình
 */
export const getConnection = (): Connection => {
  return connection;
};

/**
 * Gửi giao dịch đến mạng Solana
 */
export const sendTransaction = async (
  transaction: Transaction,
  connection: Connection
): Promise<string> => {
  try {
    // Lấy chuỗi byte của giao dịch
    const serializedTransaction = transaction.serialize();
    
    // Gửi giao dịch đến mạng
    const signature = await connection.sendRawTransaction(serializedTransaction);
    
    // Đợi xác nhận
    await connection.confirmTransaction(signature, "confirmed");
    
    return signature;
  } catch (error) {
    console.error("Lỗi khi gửi giao dịch:", error);
    throw error;
  }
};

// Xuất luôn connection từ lib/solana/index
export { connection }; 