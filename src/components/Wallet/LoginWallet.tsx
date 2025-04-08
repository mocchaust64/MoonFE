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
      setMultisigPDA(multisigPDA.toString());
      setWalletData({
        lastUpdated: Date.now(),
        multisigPDA: multisigPDA.toString(),
      });
      router.push("/dashboard");
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
        className="border-2 transition-colors hover:bg-white hover:text-black"
      >
        {isLoading ? "Connect Wallet..." : "Connect Wallet"}
      </Button>
      {error && <div className="mt-2 text-sm text-red-500">{error}</div>}
    </div>
  );
}
