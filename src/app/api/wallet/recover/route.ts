import { NextResponse } from 'next/server';
import { PublicKey, Keypair, Transaction, TransactionInstruction } from '@solana/web3.js';
import { connection } from '@/lib/solana';
import { getGuardianPDA } from '@/utils/credentialUtils';
import { PROGRAM_ID } from '@/utils/constants';
import { saveWebAuthnCredentialMapping } from '@/lib/firebase/webAuthnService';
import { hashRecoveryPhrase } from '@/utils/guardianUtils';
import { Buffer } from 'buffer';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export async function POST(req: Request) {
  try {
    const {
      multisigPDA,
      oldGuardianId,
      newGuardianId,
      recoveryPhrase,
      webauthnCredentialId,
      webauthnPublicKey,
      newGuardianName,
      newRecoveryPhrase
    } = await req.json();
    
    if (!multisigPDA || !oldGuardianId || !newGuardianId || !recoveryPhrase || !webauthnCredentialId || !webauthnPublicKey) {
      return NextResponse.json(
        { error: "Missing required information for recovery" },
        { status: 400 }
      );
    }
    
    console.log("Received access recovery request with information:", {
      multisigPDA: multisigPDA,
      oldGuardianId: oldGuardianId,
      newGuardianId: newGuardianId,
      recoveryPhraseLength: recoveryPhrase.length,
      webauthnCredentialId: webauthnCredentialId,
      webauthnPublicKeyLength: webauthnPublicKey.length,
      newGuardianName: newGuardianName || 'Not provided',
      hasNewRecoveryPhrase: !!newRecoveryPhrase
    });
    
    // Create keypair from fee payer secret key
    let feePayerKeypair;
    try {
      const feePayerSecretStr = process.env.NEXT_PUBLIC_FEE_PAYER_SECRET_KEY as string;
      const secretKeyArray = feePayerSecretStr.split(',').map(Number);
      const secretKey = new Uint8Array(secretKeyArray);
      feePayerKeypair = Keypair.fromSecretKey(secretKey);
      console.log("Fee Payer public key:", feePayerKeypair.publicKey.toString());
    } catch (keypairError) {
      console.error("Error creating keypair from secret key:", keypairError);
      return NextResponse.json(
        { error: "Unable to create keypair for fee payer" },
        { status: 500 }
      );
    }
    
    // Get PDAs for old and new guardian
    const multisigPubkey = new PublicKey(multisigPDA);
    const oldGuardianPDA = getGuardianPDA(multisigPubkey, oldGuardianId);
    const newGuardianPDA = getGuardianPDA(multisigPubkey, newGuardianId);
    
    console.log("Old Guardian PDA:", oldGuardianPDA.toString());
    console.log("New Guardian PDA:", newGuardianPDA.toString());
    
    // Convert recovery phrase to Uint8Array
    const recoveryPhraseArray = Uint8Array.from(recoveryPhrase);
    
    // Convert webauthn public key to Uint8Array
    const publicKeyArray = Uint8Array.from(webauthnPublicKey);
    
    // Create discriminator for recover_access_by_guardian
    const recoverAccessDiscriminator = Buffer.from([210, 31, 244, 215, 121, 93, 165, 99]);
    
    // Create data for parameters
    const oldGuardianIdBuffer = Buffer.alloc(8);
    oldGuardianIdBuffer.writeBigUInt64LE(BigInt(oldGuardianId), 0);
    
    const newGuardianIdBuffer = Buffer.alloc(8);
    newGuardianIdBuffer.writeBigUInt64LE(BigInt(newGuardianId), 0);
    
    // Create instruction data
    const recoverData = Buffer.concat([
      recoverAccessDiscriminator,
      oldGuardianIdBuffer,
      newGuardianIdBuffer,
      Buffer.from(recoveryPhraseArray),
      Buffer.from(publicKeyArray)
    ]);
    
    // Create and send transaction
    const transaction = new Transaction();
    
    // Create instruction for access recovery
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
    
    console.log("Sending transaction...");
    const signature = await connection.sendRawTransaction(
      transaction.serialize(),
      { skipPreflight: false }
    );
    
    console.log("Transaction sent, signature:", signature);
    
    // Wait for confirmation with new method
    const latestBlockhash = await connection.getLatestBlockhash('confirmed');
    await connection.confirmTransaction({
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      signature
    }, 'confirmed');
    
    console.log("Transaction confirmed");
    
    // Hash new recovery phrase if provided
    let hashedNewRecoveryPhrase;
    if (newRecoveryPhrase) {
      hashedNewRecoveryPhrase = await hashRecoveryPhrase(newRecoveryPhrase);
    }
    
    // Update Firebase
    try {
      await saveWebAuthnCredentialMapping(
        webauthnCredentialId,
        multisigPDA,
        Array.from(publicKeyArray),
        newGuardianId,
        newGuardianName, // Use new guardian name
        undefined, // threshold doesn't change
        true // isOwner
      );
      
      // If there's a new recovery phrase, save it to the database
      if (hashedNewRecoveryPhrase) {
        // Update recovery key in database
        console.log("Updating new recovery key for guardian");
        // Create a reference to the guardian document
        const guardianRef = doc(db, "guardian_recovery_phrases", `${multisigPDA}_${newGuardianId}`);
        await setDoc(guardianRef, {
          multisigPDA: multisigPDA,
          guardianId: newGuardianId,
          recoveryPhrase: Array.from(hashedNewRecoveryPhrase),
          updatedAt: new Date().toISOString()
        });
      }
      
      console.log("WebAuthn credential mapping updated");
    } catch (dbError) {
      console.error("Error updating database:", dbError);
      // Still continue because the transaction was successful on the blockchain
    }
    
    return NextResponse.json({
      success: true,
      signature,
      message: "Access recovery successful"
    });
  } catch (error) {
    console.error("Error during access recovery:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Error during access recovery" 
      },
      { status: 500 }
    );
  }
} 