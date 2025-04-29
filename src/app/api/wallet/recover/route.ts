import { NextResponse } from 'next/server';
import { PublicKey, Keypair, Transaction, TransactionInstruction } from '@solana/web3.js';
import { connection } from '@/lib/solana';
import { getGuardianPDA } from '@/utils/credentialUtils';
import { PROGRAM_ID } from '@/utils/constants';
import { saveWebAuthnCredentialMapping } from '@/lib/firebase/webAuthnService';
import { Buffer } from 'buffer';

export async function POST(req: Request) {
  try {
    const {
      multisigPDA,
      oldGuardianId,
      newGuardianId,
      recoveryPhrase,
      webauthnCredentialId,
      webauthnPublicKey
    } = await req.json();
    
    if (!multisigPDA || !oldGuardianId || !newGuardianId || !recoveryPhrase || !webauthnCredentialId || !webauthnPublicKey) {
      return NextResponse.json(
        { error: "Thiếu thông tin cần thiết cho quá trình khôi phục" },
        { status: 400 }
      );
    }
    
    console.log("Nhận yêu cầu khôi phục quyền truy cập với thông tin:", {
      multisigPDA: multisigPDA,
      oldGuardianId: oldGuardianId,
      newGuardianId: newGuardianId,
      recoveryPhraseLength: recoveryPhrase.length,
      webauthnCredentialId: webauthnCredentialId,
      webauthnPublicKeyLength: webauthnPublicKey.length
    });
    
    // Tạo keypair từ fee payer secret key
    let feePayerKeypair;
    try {
      const feePayerSecretStr = process.env.NEXT_PUBLIC_FEE_PAYER_SECRET_KEY as string;
      const secretKeyArray = feePayerSecretStr.split(',').map(Number);
      const secretKey = new Uint8Array(secretKeyArray);
      feePayerKeypair = Keypair.fromSecretKey(secretKey);
      console.log("Fee Payer public key:", feePayerKeypair.publicKey.toString());
    } catch (keypairError) {
      console.error("Lỗi khi tạo keypair từ secret key:", keypairError);
      return NextResponse.json(
        { error: "Không thể tạo keypair cho fee payer" },
        { status: 500 }
      );
    }
    
    // Lấy PDA cho guardian mới và cũ
    const multisigPubkey = new PublicKey(multisigPDA);
    const oldGuardianPDA = getGuardianPDA(multisigPubkey, oldGuardianId);
    const newGuardianPDA = getGuardianPDA(multisigPubkey, newGuardianId);
    
    console.log("Old Guardian PDA:", oldGuardianPDA.toString());
    console.log("New Guardian PDA:", newGuardianPDA.toString());
    
    // Chuyển đổi recovery phrase thành Uint8Array
    const recoveryPhraseArray = Uint8Array.from(recoveryPhrase);
    
    // Chuyển đổi webauthn public key thành Uint8Array
    const publicKeyArray = Uint8Array.from(webauthnPublicKey);
    
    // Tạo discriminator cho recover_access_by_guardian
    const recoverAccessDiscriminator = Buffer.from([210, 31, 244, 215, 121, 93, 165, 99]);
    
    // Tạo dữ liệu cho tham số
    const oldGuardianIdBuffer = Buffer.alloc(8);
    oldGuardianIdBuffer.writeBigUInt64LE(BigInt(oldGuardianId), 0);
    
    const newGuardianIdBuffer = Buffer.alloc(8);
    newGuardianIdBuffer.writeBigUInt64LE(BigInt(newGuardianId), 0);
    
    // Tạo data instruction
    const recoverData = Buffer.concat([
      recoverAccessDiscriminator,
      oldGuardianIdBuffer,
      newGuardianIdBuffer,
      Buffer.from(recoveryPhraseArray),
      Buffer.from(publicKeyArray)
    ]);
    
    // Tạo và gửi transaction
    const transaction = new Transaction();
    
    // Tạo instruction khôi phục quyền truy cập
    const recoverInstruction = new TransactionInstruction({
      keys: [
        { pubkey: multisigPubkey, isSigner: false, isWritable: true },
        { pubkey: oldGuardianPDA, isSigner: false, isWritable: true },
        { pubkey: feePayerKeypair.publicKey, isSigner: false, isWritable: false },
        { pubkey: newGuardianPDA, isSigner: false, isWritable: true },
        { pubkey: feePayerKeypair.publicKey, isSigner: false, isWritable: false },
        { pubkey: PublicKey.default, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: recoverData,
    });
    
    transaction.add(recoverInstruction);
    transaction.feePayer = feePayerKeypair.publicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.sign(feePayerKeypair);
    
    console.log("Gửi transaction...");
    const signature = await connection.sendRawTransaction(
      transaction.serialize(),
      { skipPreflight: false }
    );
    
    console.log("Transaction đã gửi, signature:", signature);
    
    // Đợi xác nhận với phương thức mới
    const latestBlockhash = await connection.getLatestBlockhash('confirmed');
    await connection.confirmTransaction({
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      signature
    }, 'confirmed');
    
    console.log("Transaction đã được xác nhận");
    
    // Cập nhật Firebase
    try {
      await saveWebAuthnCredentialMapping(
        webauthnCredentialId,
        multisigPDA,
        Array.from(publicKeyArray),
        newGuardianId,
        undefined, // guardianName không thay đổi
        undefined, // threshold không thay đổi
        true // isOwner
      );
      console.log("Đã cập nhật WebAuthn credential mapping");
    } catch (dbError) {
      console.error("Lỗi khi cập nhật cơ sở dữ liệu:", dbError);
      // Vẫn tiếp tục vì giao dịch đã thành công trên blockchain
    }
    
    return NextResponse.json({
      success: true,
      signature,
      message: "Khôi phục quyền truy cập thành công"
    });
  } catch (error) {
    console.error("Lỗi khi khôi phục quyền truy cập:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Lỗi khi khôi phục quyền truy cập" 
      },
      { status: 500 }
    );
  }
} 