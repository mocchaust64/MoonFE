import { PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";

import { connection } from "@/lib/solana";
import { createFeePayerKeypair } from "@/lib/solana/keypairs";
import { createAddGuardianTxManual } from "@/lib/solana/transactions";
import { getGuardianPDA } from "@/utils/credentialUtils";
import { saveGuardianData } from "@/lib/firebase/guardianService";
import { saveWebAuthnCredentialMapping } from "@/lib/firebase/webAuthnService";

// Khai báo interface cho request
interface AddGuardianRequest {
  guardianId: number;
  guardianName: string;
  recoveryHashIntermediate: number[];
  isOwner?: boolean;
  webauthnPubkey?: number[];
  multisigPDA: string;
  webauthnCredentialId?: string;
  threshold?: number;
  isInitialOwner?: boolean;
  inviteCode?: string;
}

// Khai báo interface cho response
interface AddGuardianResponse {
  success: boolean;
  signature: string;
  guardianPDA: string;
  inviteCode?: string;
  firebaseError?: string;
}

const feePayer = createFeePayerKeypair();

// Xử lý chính của API route
export async function POST(req: Request) {
  try {
    const requestBody = await req.json();
    console.log("Guardian add request body:", JSON.stringify(requestBody, null, 2));

    // Xử lý dữ liệu đầu vào
    const validationResult = validateInput(requestBody);
    if (!validationResult.isValid) {
      return NextResponse.json(
        { error: validationResult.error },
        { status: 400 }
      );
    }
    
    const { 
      multisigPubkey, 
      guardianPubkey, 
      recoveryHashArray,
      webauthnPubkeyArray
    } = await processInputData(requestBody);
    
    // Kiểm tra guardian đã tồn tại
    try {
      const guardianExists = await checkGuardianExists(guardianPubkey);
      if (guardianExists) {
        return NextResponse.json(
          { error: `Guardian with ID ${requestBody.guardianId} already exists on the blockchain` },
          { status: 400 }
        );
      }
    } catch (error) {
      console.warn("Error checking existing guardian:", error);
    }
    
    // Tạo và gửi transaction
    try {
      const signature = await createAndSendTransaction(
        multisigPubkey,
        guardianPubkey,
        requestBody,
        recoveryHashArray,
        webauthnPubkeyArray
      );
      
      // Lưu dữ liệu vào Firebase
      const response = await saveToFirebase(
        signature,
        guardianPubkey,
        requestBody,
        recoveryHashArray,
        webauthnPubkeyArray
      );
      
      return NextResponse.json(response);
    } catch (txError) {
      console.error("Error processing transaction:", txError);
        return NextResponse.json(
        { error: `Transaction error: ${txError instanceof Error ? txError.message : String(txError)}` },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error adding guardian:", error);
          return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Hàm kiểm tra đầu vào
function validateInput(data: AddGuardianRequest): { isValid: boolean; error?: string } {
  // Kiểm tra guardianId
  if (!data.guardianId) {
    return { isValid: false, error: "Missing guardianId field" };
  }
  
  // Kiểm tra guardianName
  if (!data.guardianName) {
    return { isValid: false, error: "Missing guardianName field" };
  }
  
  // Kiểm tra recoveryHashIntermediate
  if (!data.recoveryHashIntermediate) {
    return { isValid: false, error: "Missing recoveryHashIntermediate field" };
  }
  
  // Kiểm tra multisigPDA
  if (!data.multisigPDA) {
    return { isValid: false, error: "Missing multisigPDA field" };
  }
  
  // Kiểm tra webauthnCredentialId khi có webauthnPubkey
  if (!data.webauthnCredentialId && data.webauthnPubkey) {
    return { 
      isValid: false, 
      error: "Missing webauthnCredentialId field when webauthnPubkey is provided" 
    };
  }
  
  return { isValid: true };
}

// Hàm xử lý dữ liệu đầu vào
async function processInputData(data: AddGuardianRequest) {
  // Chuyển đổi Public Key
  const multisigPubkey = new PublicKey(data.multisigPDA);
  
  // Tính GuardianPDA
  const guardianPubkey = getGuardianPDA(multisigPubkey, Number(data.guardianId));
  console.log(`Calculated Guardian PDA: ${guardianPubkey.toString()} for ID: ${data.guardianId}`);
  
  // Chuyển đổi recoveryHashIntermediate
  const recoveryHashArray = Uint8Array.from(data.recoveryHashIntermediate);
  if (recoveryHashArray.length !== 32) {
    throw new Error(`Recovery hash must be 32 bytes, got ${recoveryHashArray.length} bytes`);
  }
  
  // Chuyển đổi webauthnPubkey nếu có
  let webauthnPubkeyArray: Uint8Array | undefined;
  if (data.webauthnPubkey) {
    webauthnPubkeyArray = Uint8Array.from(data.webauthnPubkey);
    if (webauthnPubkeyArray.length !== 33) {
      throw new Error(`WebAuthn public key must be 33 bytes, got ${webauthnPubkeyArray.length} bytes`);
    }
  }
  
  return {
    multisigPubkey,
    guardianPubkey,
    recoveryHashArray,
    webauthnPubkeyArray
  };
}

// Kiểm tra guardian đã tồn tại
async function checkGuardianExists(guardianPubkey: PublicKey): Promise<boolean> {
  const existingGuardian = await connection.getAccountInfo(guardianPubkey);
  return !!existingGuardian && existingGuardian.data.length > 0;
}

// Tạo và gửi transaction
async function createAndSendTransaction(
  multisigPubkey: PublicKey,
  guardianPubkey: PublicKey,
  data: AddGuardianRequest,
  recoveryHashArray: Uint8Array,
  webauthnPubkeyArray?: Uint8Array
): Promise<string> {
      console.log("Creating add guardian transaction with parameters:", {
        multisigPubkey: multisigPubkey.toString(),
        guardianPDA: guardianPubkey.toString(),
    guardianId: Number(data.guardianId),
    guardianName: data.guardianName,
        hasWebauthnPubkey: webauthnPubkeyArray ? "yes" : "no",
        isOwner: true
      });
      
  // Tạo transaction
  const transaction = createAddGuardianTxManual({
    multisigPDA: multisigPubkey,
    guardianPDA: guardianPubkey,
    feePayer: feePayer.publicKey,
    guardianName: data.guardianName,
    guardianId: Number(data.guardianId),
    recoveryHashIntermediate: recoveryHashArray,
    webauthnPubkey: webauthnPubkeyArray,
    isOwner: true
  });
      
      console.log("Transaction created successfully");

  // Gửi transaction
  const latestBlockhash = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = latestBlockhash.blockhash;
  transaction.feePayer = feePayer.publicKey;
  transaction.sign(feePayer);
  
  const signature = await connection.sendRawTransaction(
    transaction.serialize(),
    { skipPreflight: false }
  );
      console.log("Transaction sent, signature:", signature);

  // Xác nhận transaction
  await connection.confirmTransaction({
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    signature
  }, 'confirmed');
      console.log("Transaction confirmed");

  return signature;
}

// Lưu dữ liệu vào Firebase
async function saveToFirebase(
  signature: string,
  guardianPubkey: PublicKey,
  data: AddGuardianRequest,
  recoveryHashArray: Uint8Array,
  webauthnPubkeyArray?: Uint8Array
): Promise<AddGuardianResponse> {
  // Tạo response object
      const response: AddGuardianResponse = {
        success: true,
        signature,
        guardianPDA: guardianPubkey.toString(),
      };

  // Nếu không có WebAuthn, trả về response ngay
  if (!data.webauthnCredentialId || !data.webauthnPubkey) {
    return response;
  }
  
  try {
    // Đảm bảo publicKeyArray là số nguyên array
    const publicKeyArray = Array.isArray(data.webauthnPubkey) 
      ? data.webauthnPubkey 
            : Array.from(webauthnPubkeyArray || new Uint8Array());

    // Lưu WebAuthn credential mapping
          await saveWebAuthnCredentialMapping(
      data.webauthnCredentialId,
      data.multisigPDA,
      publicKeyArray,
      Number(data.guardianId),
      data.guardianName,
      data.threshold ?? 1,
            true // isOwner
          );
          console.log("WebAuthn credential mapping saved to Firebase");

    // Nếu có inviteCode, lưu thêm thông tin guardian
    if (data.inviteCode) {
            await saveGuardianData({
        inviteCode: data.inviteCode,
        guardianId: Number(data.guardianId),
        multisigPDA: data.multisigPDA,
              hashedRecoveryBytes: Array.from(recoveryHashArray),
        webauthnCredentialId: data.webauthnCredentialId,
        webauthnPublicKey: publicKeyArray,
              status: "completed",
        guardianName: data.guardianName,
              txSignature: signature,
        isOwner: true
      });
      console.log("Guardian data saved to Firebase with invite code:", data.inviteCode);
      response.inviteCode = data.inviteCode;
    } 
    // Đây là guardian chính (owner) khi isInitialOwner=true hoặc guardianId=1
    else if (data.isInitialOwner || Number(data.guardianId) === 1) {
      // Tạo một inviteCode cho guardian chính nếu không có
      const generatedInviteCode = `owner_${data.multisigPDA.substring(0, 8)}_${Date.now()}`;
      await saveGuardianData({
        inviteCode: generatedInviteCode,
        guardianId: Number(data.guardianId),
        multisigPDA: data.multisigPDA,
        hashedRecoveryBytes: Array.from(recoveryHashArray),
        webauthnCredentialId: data.webauthnCredentialId,
        webauthnPublicKey: publicKeyArray,
        status: "completed",
        guardianName: data.guardianName,
        txSignature: signature,
        isOwner: true
      });
      console.log("Initial owner guardian saved to Firebase with generated invite code:", generatedInviteCode);
      response.inviteCode = generatedInviteCode;
    }
        } catch (firebaseError) {
          console.error("Error saving to Firebase:", firebaseError);
          // Không throw lỗi, chỉ log ra vì transaction đã thành công
          response.firebaseError = firebaseError instanceof Error 
            ? firebaseError.message 
            : "Unknown Firebase error";
  }
  
  return response;
}
