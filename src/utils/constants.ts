import { PublicKey } from '@solana/web3.js';

// Lấy PROGRAM_ID từ biến môi trường hoặc dùng giá trị mặc định giống frontend_test
const PROGRAM_ID_STRING = process.env.NEXT_PUBLIC_PROGRAM_ID ?? '5tFJskbgqrPxb992SUf6JzcQWJGbJuvsta2pRnZBcygN';

// Export PROGRAM_ID để có thể sử dụng trong toàn bộ ứng dụng
export const PROGRAM_ID = new PublicKey(PROGRAM_ID_STRING); 