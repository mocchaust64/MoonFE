import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { program } from "@/lib/solana"; // Utility để lấy Anchor Program
import { createTransferTx } from "@/lib/solana/transactions";
import { createSecp256r1Instruction } from "@/lib/solana/secp356r1";
import { createFeePayerKeypair } from "@/lib/solana/keypairs";


// Interface cho request body
interface TransferRequest {
  destination: string;
  amount: number;
  multisigPDA: string;
  guardianPDA: string;
  nonce: number;
  timestamp: number;
  message: string;       // base64 string
  signature: string;     // base64 string
  publicKey: string;     // base64 string
  credentialId: string;  // Thêm credentialId
  authenticatorData: string;
  clientDataHash: string;
}

const feePayer = createFeePayerKeypair();

export async function POST(req: Request) {
  try {
    const body: TransferRequest = await req.json();

    if (!body.destination || !body.amount || !body.multisigPDA || !body.guardianPDA || !body.credentialId) {
      return NextResponse.json(
        { 
          error: "Missing required fields",
        },
        { status: 400 }
      );
    }

    // 2. Convert string addresses to PublicKey
    const destination = new PublicKey(body.destination);
    const multisigPDA = new PublicKey(body.multisigPDA);
    const guardianPDA = new PublicKey(body.guardianPDA);

    // Chuyển đổi từ base64 string sang Buffer
    const messageBuffer = Buffer.from(body.message, 'base64');
    const signatureBuffer = Buffer.from(body.signature, 'base64');
    const publicKeyBuffer = Buffer.from(body.publicKey, 'base64');
    const authenticatorDataBuffer = Buffer.from(body.authenticatorData, 'base64');
    const clientDataHashBuffer = Buffer.from(body.clientDataHash, 'base64');

    // Tạo verification data: authenticatorData + clientDataHash
    const verificationData = Buffer.concat([authenticatorDataBuffer, clientDataHashBuffer]);

    // 3. Create secp256r1 instruction
    const secp256r1Ix = createSecp256r1Instruction(
      verificationData,    
      publicKeyBuffer,
      signatureBuffer,
      false
    );

    // 4. Create transfer transaction
    const transferTx = await createTransferTx(
      program,
      {
        destination: destination,
        amount: body.amount,
        nonce: body.nonce,
        timestamp: body.timestamp,
        message: messageBuffer
      },
      multisigPDA,
      guardianPDA,
      feePayer.publicKey
    );

    // 5. Add secp256r1 instruction và set feePayer
    transferTx.instructions.unshift(secp256r1Ix);
    transferTx.feePayer = feePayer.publicKey;
    
    // Lấy blockhash mới
    const { blockhash } = await program.provider.connection.getLatestBlockhash();
    transferTx.recentBlockhash = blockhash;
    transferTx.sign(feePayer);

    // 6. Return serialized transaction đã được ký
    return NextResponse.json({
      success: true,
      transaction: transferTx.serialize().toString("base64"),
      message: "Transfer transaction created successfully"
    });

  } catch (error) {
    console.error("Error creating transfer transaction:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Unknown error",
        details: error
      },
      { status: 500 }
    );
  }
}
