"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { searchGuardiansByUsername } from "@/lib/firebase/guardianService"; 
import { hashRecoveryPhrase } from "@/utils/guardianUtils";
import { createWebAuthnCredential } from "@/utils/webauthnUtils";
import { GuardianData } from "@/types/guardian";
import { useRouter } from "next/navigation";

interface RecoveryFormProps {
  currentStep: "search" | "verify" | "create" | "confirm";
  onStepChange: (step: "search" | "verify" | "create" | "confirm") => void;
}

export function RecoveryForm({ currentStep, onStepChange }: RecoveryFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [recoveryPhrase, setRecoveryPhrase] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedGuardian, setSelectedGuardian] = useState<GuardianData | null>(null);
  const [guardianOptions, setGuardianOptions] = useState<GuardianData[]>([]);
  
  // Hàm tìm kiếm guardian theo username
  const handleSearch = async () => {
    try {
      setIsLoading(true);
      setError("");
      
      const results = await searchGuardiansByUsername(username);
      
      if (!results || results.length === 0) {
        setError("Không tìm thấy guardian với tên người dùng này");
        return;
      }
      
      setGuardianOptions(results);
      onStepChange("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi tìm kiếm");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Hàm xác thực recovery phrase
  const handleVerify = async () => {
    try {
      setIsLoading(true);
      setError("");
      
      if (!recoveryPhrase) {
        setError("Vui lòng nhập mã khôi phục");
        return;
      }
      
      if (!selectedGuardian) {
        setError("Vui lòng chọn guardian");
        return;
      }
      
      onStepChange("create");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi xác thực");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Hàm tạo thông tin xác thực mới và khôi phục
  const handleRecover = async () => {
    try {
      setIsLoading(true);
      setError("");
      
      if (!selectedGuardian) {
        setError("Không có guardian được chọn");
        return;
      }
      
      // 1. Tạo WebAuthn credential mới
      const webAuthnResult = await createWebAuthnCredential(selectedGuardian.guardianName || "My Wallet");
      
      // 2. Hash recovery phrase
      const hashedRecoveryBytes = await hashRecoveryPhrase(recoveryPhrase);
      
      // 3. Gọi API để thực hiện khôi phục
      const response = await fetch("/api/wallet/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          multisigPDA: selectedGuardian.multisigPDA,
          oldGuardianId: selectedGuardian.guardianId,
          newGuardianId: selectedGuardian.guardianId, // Sử dụng cùng ID
          recoveryPhrase: Array.from(hashedRecoveryBytes),
          webauthnCredentialId: webAuthnResult.credentialId,
          webauthnPublicKey: webAuthnResult.publicKey
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Lỗi khi khôi phục quyền truy cập");
      }
      
      // Lưu thông tin credential vào localStorage
      localStorage.setItem('current_credential_id', webAuthnResult.credentialId);
      localStorage.setItem('current_guardian_id', selectedGuardian.guardianId.toString());
      
      onStepChange("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi khôi phục");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Hiển thị các bước khác nhau dựa trên currentStep
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>
          {currentStep === "search" && "Tìm kiếm tài khoản"}
          {currentStep === "verify" && "Xác thực quyền sở hữu"}
          {currentStep === "create" && "Tạo thông tin xác thực mới"}
          {currentStep === "confirm" && "Khôi phục thành công"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {currentStep === "search" && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Tên Guardian</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập tên guardian của bạn"
                required
              />
            </div>
            
            <Button 
              onClick={handleSearch}
              disabled={isLoading || !username}
              className="w-full"
            >
              {isLoading ? "Đang tìm kiếm..." : "Tìm kiếm"}
            </Button>
          </div>
        )}
        
        {currentStep === "verify" && (
          <div className="space-y-4">
            {guardianOptions.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium">Chọn guardian</label>
                <div className="space-y-2">
                  {guardianOptions.map((guardian) => (
                    <div 
                      key={guardian.inviteCode}
                      className={`cursor-pointer rounded-md border p-3 ${selectedGuardian?.inviteCode === guardian.inviteCode ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : ''}`}
                      onClick={() => setSelectedGuardian(guardian)}
                    >
                      <p className="font-medium">{guardian.guardianName || "Unnamed Guardian"}</p>
                      <p className="text-sm text-muted-foreground">Guardian ID: {guardian.guardianId}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div>
              <label className="mb-1 block text-sm font-medium">Mã khôi phục</label>
              <Input
                type="password"
                value={recoveryPhrase}
                onChange={(e) => setRecoveryPhrase(e.target.value)}
                placeholder="Nhập mã khôi phục của bạn"
                required
              />
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={() => onStepChange("search")}
              >
                Quay lại
              </Button>
              <Button 
                onClick={handleVerify}
                disabled={isLoading || !recoveryPhrase || !selectedGuardian}
                className="flex-1"
              >
                {isLoading ? "Đang xác thực..." : "Tiếp tục"}
              </Button>
            </div>
          </div>
        )}
        
        {currentStep === "create" && (
          <div className="space-y-4">
            <p className="text-center">
              Bạn sẽ tạo một thông tin xác thực mới để thay thế thông tin cũ.
              Thiết bị của bạn sẽ yêu cầu xác thực (vân tay, Face ID, v.v.).
            </p>
            
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={() => onStepChange("verify")}
              >
                Quay lại
              </Button>
              <Button 
                onClick={handleRecover}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? "Đang xử lý..." : "Khôi phục quyền truy cập"}
              </Button>
            </div>
          </div>
        )}
        
        {currentStep === "confirm" && (
          <div className="space-y-4 text-center">
            <p className="text-green-600 font-semibold">
              Đã khôi phục quyền truy cập thành công!
            </p>
            <p>Bạn có thể đăng nhập vào ví của mình với thông tin xác thực mới.</p>
            
            <Button 
              onClick={() => router.push("/dashboard")}
              className="w-full"
            >
              Đi đến Dashboard
            </Button>
          </div>
        )}
        
        {error && (
          <div className="mt-4 text-sm text-red-500">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 