"use client";

import { PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getWalletByCredentialId } from "@/lib/firebase/webAuthnService";
import { connection } from "@/lib/solana";
import { useWalletStore } from "@/store/walletStore";
import { getMultisigPDA } from "@/utils/credentialUtils";
import { getWebAuthnAssertionForLogin } from "@/utils/webauthnUtils";
import Link from "next/link";

export default function LoginWallet() {
  const router = useRouter();
  const { setMultisigPDA, setWalletData } = useWalletStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      setError("");

      // 1. Lấy WebAuthn assertion
      const assertionResult = await getWebAuthnAssertionForLogin("", true);
      if (!assertionResult.success || !assertionResult.rawId) {
        throw new Error("Không thể xác thực với thiết bị");
      }

      // 2. Chuyển đổi credential ID sang các format cần thiết
      const credentialIdHex = Buffer.from(assertionResult.rawId).toString(
        "hex",
      );
      const rawIdBase64 = Buffer.from(assertionResult.rawId).toString("base64");

      let multisigPDA: PublicKey;

      // 3. Thử tìm trong Firebase (cho guardian thêm sau)
      const mapping = await getWalletByCredentialId(credentialIdHex);

      if (mapping) {
        console.log("Tìm thấy guardian trong Firebase");
        multisigPDA = new PublicKey(mapping.walletAddress);
      } else {
        console.log("Không tìm thấy trong Firebase, thử tính PDA cho owner");
        // 4. Nếu không có trong Firebase -> thử tính PDA (cho guardian đầu tiên/owner)
        multisigPDA = getMultisigPDA(rawIdBase64);
      }

      // 5. Kiểm tra ví trên blockchain
      console.log("Kiểm tra ví tại địa chỉ:", multisigPDA.toString());
      const multisigAccount = await connection.getAccountInfo(multisigPDA);

      if (!multisigAccount) {
        throw new Error(
          "Không tìm thấy ví trên blockchain. Có thể bạn chưa tạo ví hoặc credential không hợp lệ.",
        );
      }

      // 6. Login thành công
      console.log("Login thành công với ví:", multisigPDA.toString());

      // Lưu thông tin credential và guardianId vào localStorage
      localStorage.setItem('current_credential_id', rawIdBase64);
      
      // Lấy thông tin guardian từ Firebase để lưu guardianId
      const credentialInfo = await getWalletByCredentialId(rawIdBase64);
      if (credentialInfo && credentialInfo.guardianId !== undefined) {
        console.log("Lưu guardianId vào localStorage:", credentialInfo.guardianId);
        localStorage.setItem('current_guardian_id', credentialInfo.guardianId.toString());
      }
      
      setMultisigPDA(multisigPDA.toString());
      setWalletData({
        lastUpdated: Date.now(),
        multisigPDA: multisigPDA.toString(),
      });
      router.push("/(app)/dashboard");
    } catch (err) {
      console.error("Lỗi khi đăng nhập:", err);
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button
        onClick={handleLogin}
        disabled={isLoading}
        variant="outline"
        size="lg"
        className="w-full border border-blue-500/30 bg-blue-900/10 backdrop-blur-sm text-blue-300 hover:bg-blue-800/20 transition-all duration-300 rounded-md py-3 h-13 px-8 flex items-center justify-center font-medium text-base"
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Đang kết nối...
          </span>
        ) : (
          <span className="flex items-center">
            Connect Wallet
            <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </span>
        )}
      </Button>
      
      {error && (
        <div className="mt-2 rounded-md bg-red-500/10 p-2 text-sm text-red-500">
          {error}
        </div>
      )}
      
      <div className="text-center">
        <Link 
          href="/recover-access" 
          className="text-sm text-blue-400 transition-colors hover:text-blue-300 hover:underline"
        >
          
        </Link>
      </div>
    </div>
  );
}
