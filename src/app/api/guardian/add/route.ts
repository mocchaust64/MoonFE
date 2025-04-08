import { PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";

import { connection, program } from "@/lib/solana";
import { createFeePayerKeypair } from "@/lib/solana/keypairs";
import { createAddGuardianTx } from "@/lib/solana/transactions";

const feePayer = createFeePayerKeypair();

export async function POST(req: Request) {
  try {
    // 1. Lấy dữ liệu từ request
    const {
      guardianId,
      recoveryHashIntermediate,
      webauthnPubkey,
      multisigPDA,
      guardianPDA,
    } = await req.json();

    // 2. Validate input
    if (
      !guardianId ||
      !recoveryHashIntermediate ||
      !multisigPDA ||
      !guardianPDA
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // 3. Chuyển đổi các PublicKey
    const multisigPubkey = new PublicKey(multisigPDA);
    const guardianPubkey = new PublicKey(guardianPDA);

    // 4. Chuyển đổi recoveryHashIntermediate thành Uint8Array[32]
    const recoveryHashArray = Uint8Array.from(recoveryHashIntermediate);
    if (recoveryHashArray.length !== 32) {
      throw new Error("Recovery hash must be 32 bytes");
    }

    // 5. Chuyển đổi webauthnPubkey thành Uint8Array[33]
    const webauthnPubkeyArray = webauthnPubkey
      ? Uint8Array.from(webauthnPubkey)
      : undefined;
    if (webauthnPubkeyArray && webauthnPubkeyArray.length !== 33) {
      throw new Error("WebAuthn public key must be 33 bytes");
    }

    // 6. Tạo transaction
    const transaction = await createAddGuardianTx(
      program,
      {
        guardianId: Number(guardianId),
        recoveryHashIntermediate: recoveryHashArray,
        webauthnPubkey: webauthnPubkeyArray,
      },
      multisigPubkey,
      guardianPubkey,
      feePayer.publicKey, // Dùng feePayer làm guardian_pubkey
      feePayer.publicKey, // Và làm payer
    );

    // 7. Gửi transaction
    const signature = await connection.sendTransaction(transaction, [feePayer]);

    // 8. Trả về kết quả
    return NextResponse.json({
      success: true,
      signature,
      guardianPDA: guardianPubkey.toString(),
    });
  } catch (error) {
    console.error("Error adding guardian:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
