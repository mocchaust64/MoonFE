// src/app/api/wallet/create/route.ts
import { PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";

import { connection, program } from "@/lib/solana";
import { createFeePayerKeypair } from "@/lib/solana/keypairs";
import { createInitializeMultisigTx } from "@/lib/solana/transactions";

// Khởi tạo kết nối và fee payer
const feePayer = createFeePayerKeypair();

export async function POST(req: Request) {
  try {
    const { threshold, credentialId, name, multisigPDA } = await req.json();

    if (!threshold || !credentialId || !name || !multisigPDA) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const multisigPubkey = new PublicKey(multisigPDA);
    const transaction = await createInitializeMultisigTx(
      program,
      { threshold, credentialId, name },
      multisigPubkey,
      feePayer,
    );

    const signature = await connection.sendTransaction(transaction, [feePayer]);

    return NextResponse.json({
      success: true,
      signature,
      multisigPDA: multisigPubkey.toString(),
    });
  } catch (error) {
    console.error("Error creating wallet:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
