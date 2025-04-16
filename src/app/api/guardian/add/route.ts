import { PublicKey, Connection } from "@solana/web3.js";
import { NextResponse } from "next/server";

import { connection, program } from "@/lib/solana";
import { createFeePayerKeypair } from "@/lib/solana/keypairs";
import { createAddGuardianTxManual } from "@/lib/solana/transactions";
import { getGuardianPDA } from "@/utils/credentialUtils";
import { saveGuardianData } from "@/lib/firebase/guardianService";
import { saveWebAuthnCredentialMapping } from "@/lib/firebase/webAuthnService";

// Khai báo interface cho response
interface AddGuardianResponse {
  success: boolean;
  signature: string;
  guardianPDA: string;
  inviteCode?: string;
  firebaseError?: string;
}

const feePayer = createFeePayerKeypair();

export async function POST(req: Request) {
  try {
    // Đọc và log toàn bộ request body
    const requestBody = await req.json();
    console.log("Guardian add request body:", JSON.stringify(requestBody, null, 2));

    // 1. Lấy dữ liệu từ request
    const {
      guardianId,
      guardianName,
      recoveryHashIntermediate,
      isOwner = true,
      webauthnPubkey,
      multisigPDA,
      webauthnCredentialId,
      threshold = 1,
      isInitialOwner = false,
      inviteCode = "" 
    } = requestBody;

    // Log từng trường riêng biệt để debug
    console.log("guardianId:", guardianId);
    console.log("guardianName:", guardianName);
    console.log("recoveryHashIntermediate:", recoveryHashIntermediate ? "present" : "missing");
    console.log("webauthnPubkey:", webauthnPubkey ? "present" : "missing");
    console.log("webauthnCredentialId:", webauthnCredentialId || "missing");
    console.log("multisigPDA:", multisigPDA);
    console.log("threshold:", threshold);
    console.log("isInitialOwner:", isInitialOwner);
    console.log("inviteCode:", inviteCode);

    // 2. Validate input
    if (!guardianId) {
      return NextResponse.json(
        { error: "Missing guardianId field" },
        { status: 400 },
      );
    }
    
    if (!guardianName) {
      return NextResponse.json(
        { error: "Missing guardianName field" },
        { status: 400 },
      );
    }
    
    if (!recoveryHashIntermediate) {
      return NextResponse.json(
        { error: "Missing recoveryHashIntermediate field" },
        { status: 400 },
      );
    }
    
    if (!multisigPDA) {
      return NextResponse.json(
        { error: "Missing multisigPDA field" },
        { status: 400 },
      );
    }

    if (!webauthnCredentialId && webauthnPubkey) {
      return NextResponse.json(
        { error: "Missing webauthnCredentialId field when webauthnPubkey is provided" },
        { status: 400 },
      );
    }

    // 3. Chuyển đổi các PublicKey
    const multisigPubkey = new PublicKey(multisigPDA);
    
    // 4. Tự tính GuardianPDA từ multisigPDA và guardianId, không phụ thuộc vào client
    const guardianPubkey = getGuardianPDA(multisigPubkey, Number(guardianId));
    console.log(`Calculated Guardian PDA: ${guardianPubkey.toString()} for ID: ${guardianId}`);

    // 5. Kiểm tra xem guardian đã tồn tại chưa (tránh thêm trùng lặp)
    try {
      // Kiểm tra trên blockchain
      const existingGuardian = await connection.getAccountInfo(guardianPubkey);
      if (existingGuardian && existingGuardian.data.length > 0) {
        return NextResponse.json(
          { error: `Guardian with ID ${guardianId} already exists on the blockchain` },
          { status: 400 },
        );
      }
    } catch (error) {
      console.warn("Error checking existing guardian:", error);
      
    }

    // 6. Chuyển đổi recoveryHashIntermediate thành Uint8Array[32]
    try {
      const recoveryHashArray = Uint8Array.from(recoveryHashIntermediate);
      console.log("Recovery hash length:", recoveryHashArray.length);
      
      if (recoveryHashArray.length !== 32) {
        return NextResponse.json(
          { error: `Recovery hash must be 32 bytes, got ${recoveryHashArray.length} bytes` },
          { status: 400 },
        );
      }

      // 7. Chuyển đổi webauthnPubkey thành Uint8Array[33]
      const webauthnPubkeyArray = webauthnPubkey
        ? Uint8Array.from(webauthnPubkey)
        : undefined;
      
      if (webauthnPubkeyArray) {
        console.log("WebAuthn pubkey length:", webauthnPubkeyArray.length);
        if (webauthnPubkeyArray.length !== 33) {
          return NextResponse.json(
            { error: `WebAuthn public key must be 33 bytes, got ${webauthnPubkeyArray.length} bytes` },
            { status: 400 },
          );
        }
      }

      // 8. Tạo transaction
      console.log("Creating add guardian transaction with parameters:", {
        multisigPubkey: multisigPubkey.toString(),
        guardianPDA: guardianPubkey.toString(),
        guardianId: Number(guardianId),
        guardianName: guardianName,
        hasWebauthnPubkey: webauthnPubkeyArray ? "yes" : "no",
        isOwner: true
      });
      
      // Sử dụng phương pháp thủ công để tạo transaction
      const transaction = createAddGuardianTxManual(
        multisigPubkey, 
        guardianPubkey,
        feePayer.publicKey,
        guardianName,
        Number(guardianId),
        recoveryHashArray,
        webauthnPubkeyArray,
        true
      );
      
      console.log("Transaction created successfully");

      // 9. Gửi transaction
      const signature = await connection.sendTransaction(transaction, [feePayer]);
      console.log("Transaction sent, signature:", signature);

      // 10. Đợi xác nhận
      await connection.confirmTransaction(signature, "confirmed");
      console.log("Transaction confirmed");

      // 11. Lưu thông tin vào Firebase nếu có WebAuthn
      // Tạo đối tượng response trước
      const response: AddGuardianResponse = {
        success: true,
        signature,
        guardianPDA: guardianPubkey.toString(),
      };

      if (webauthnCredentialId && webauthnPubkey) {
        try {
          // Đảm bảo rằng webauthnPubkey là mảng số (number[])
          const publicKeyArray = Array.isArray(webauthnPubkey) 
            ? webauthnPubkey 
            : Array.from(webauthnPubkeyArray || new Uint8Array());

          // Lưu ánh xạ WebAuthn với một định dạng đồng nhất
          await saveWebAuthnCredentialMapping(
            webauthnCredentialId,
            multisigPDA,
            publicKeyArray, // Đảm bảo là số nguyên array
            Number(guardianId),
            guardianName,
            threshold,
            true // isOwner
          );
          console.log("WebAuthn credential mapping saved to Firebase");

          // Nếu có inviteCode, lưu thêm thông tin guardian vào bảng guardians
          if (inviteCode) {
            await saveGuardianData({
              inviteCode,
              guardianId: Number(guardianId),
              multisigPDA,
              hashedRecoveryBytes: Array.from(recoveryHashArray),
              webauthnCredentialId,
              webauthnPublicKey: publicKeyArray, // Sử dụng cùng định dạng như trên
              status: "completed",
              guardianName,
              txSignature: signature,
              isOwner: true // Đánh dấu là owner
            });
            console.log("Guardian data saved to Firebase with invite code:", inviteCode);
            response.inviteCode = inviteCode;
          } else if (isInitialOwner) {
            // Đây là owner đầu tiên (không có invite code)
            console.log("Initial owner WebAuthn mapping saved");
          }
        } catch (firebaseError) {
          console.error("Error saving to Firebase:", firebaseError);
          // Không throw lỗi, chỉ log ra vì transaction đã thành công
          response.firebaseError = firebaseError instanceof Error 
            ? firebaseError.message 
            : "Unknown Firebase error";
        }
      }

      // 12. Trả về kết quả
      return NextResponse.json(response);
    } catch (conversionError) {
      console.error("Error converting data:", conversionError);
      return NextResponse.json(
        { error: `Data conversion error: ${conversionError instanceof Error ? conversionError.message : String(conversionError)}` },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("Error adding guardian:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
