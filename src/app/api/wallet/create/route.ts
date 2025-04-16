// src/app/api/wallet/create/route.ts
import { PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";
import { connection, program } from "@/lib/solana";
import { createFeePayerKeypair } from "@/lib/solana/keypairs";
import { createInitializeMultisigTx } from "@/lib/solana/transactions";
import { saveWalletMetadata } from "@/lib/firebase/walletService";

// Khởi tạo kết nối và fee payer
const feePayer = createFeePayerKeypair();

export async function POST(req: Request) {
  try {
    console.log("Current RPC endpoint:", connection.rpcEndpoint);
    console.log("feePayer:", feePayer.publicKey);
    const { threshold, credentialId, name, multisigPDA } = await req.json();

    if (!threshold || !credentialId || !multisigPDA) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const multisigPubkey = new PublicKey(multisigPDA);
    const transaction = await createInitializeMultisigTx(
      program,
      { threshold, credentialId },
      multisigPubkey,
      feePayer,
    );

    // Check fee payer balance before sending transaction
    const balance = await connection.getBalance(feePayer.publicKey);
    if (balance === 0) {
      return NextResponse.json(
        { 
          error: "Fee payer account has no SOL. Please fund the account first.",
          feePayerAddress: feePayer.publicKey.toString()
        },
        { status: 400 }
      );
    }

    const signature = await connection.sendTransaction(transaction, [feePayer]);
    
    // Lưu tên ví vào Firebase
    if (name) {
      try {
        await saveWalletMetadata(multisigPDA, { name });
        console.log(`Wallet name "${name}" saved to Firebase for ${multisigPDA}`);
      } catch (firebaseError) {
        console.error("Error saving wallet name to Firebase:", firebaseError);
        // Không fail transaction nếu lưu Firebase thất bại
      }
    }

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
