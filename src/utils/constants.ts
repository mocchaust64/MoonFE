import { PublicKey } from '@solana/web3.js';

// Lấy PROGRAM_ID từ biến môi trường hoặc dùng giá trị mặc định giống frontend_test
const PROGRAM_ID_STRING = process.env.NEXT_PUBLIC_PROGRAM_ID ?? '6Y3N5AQRQtviTrmRcf29yHWBu3ft7xEoj8kqmykDGvKP';

// Export PROGRAM_ID để có thể sử dụng trong toàn bộ ứng dụng
export const PROGRAM_ID = new PublicKey(PROGRAM_ID_STRING);

// Program ID của Secp256r1
export const SECP256R1_PROGRAM_ID = new PublicKey("Secp256r1SigVerify1111111111111111111111111"); 