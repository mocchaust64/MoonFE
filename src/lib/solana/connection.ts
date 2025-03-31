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
