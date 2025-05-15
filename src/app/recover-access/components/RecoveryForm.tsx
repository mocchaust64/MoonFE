"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { searchGuardiansByUsername } from "@/lib/firebase/guardianService"; 
import { hashRecoveryPhrase } from "@/utils/guardianUtils";
import { createWebAuthnCredential } from "@/utils/webauthnUtils";
import { GuardianData } from "@/types/guardian";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle, User, KeySquare, ArrowLeft, ArrowRight, Shield } from "lucide-react";
import { motion } from "framer-motion";

interface RecoveryFormProps {
  readonly currentStep: "search" | "create";
  readonly onStepChange: (step: "search" | "create") => void;
}

export function RecoveryForm({ currentStep, onStepChange }: RecoveryFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [recoveryPhrase, setRecoveryPhrase] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedGuardian, setSelectedGuardian] = useState<GuardianData | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  
  // Hàm tìm kiếm guardian theo username và xác thực recovery phrase (Bước 1)
  const handleSearch = async () => {
    try {
      setIsLoading(true);
      setError("");
      
      if (!username) {
        setError("Vui lòng nhập tên guardian của bạn");
        return;
      }
      
      if (!recoveryPhrase) {
        setError("Vui lòng nhập mã khôi phục");
        return;
      }
      
      // Tìm kiếm guardian
      const results = await searchGuardiansByUsername(username);
      
      if (!results || results.length === 0) {
        setError("Không tìm thấy guardian với tên người dùng này");
        return;
      }
      
      // Chọn guardian đầu tiên (thường sẽ chỉ có một kết quả)
      setSelectedGuardian(results[0]);
      
      // Chuyển sang bước tạo thông tin xác thực mới
      onStepChange("create");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi tìm kiếm");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Hàm tạo thông tin xác thực mới và khôi phục (Bước 2)
  const handleRecover = async () => {
    try {
      setIsLoading(true);
      setError("");
      
      if (!selectedGuardian) {
        setError("Không có guardian được chọn");
        return;
      }
      
      // 1. Tạo WebAuthn credential mới
      const webAuthnResult = await createWebAuthnCredential(selectedGuardian.guardianName ?? "My Wallet");
      
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
        throw new Error(data.error ?? "Lỗi khi khôi phục quyền truy cập");
      }
      
      // Lưu thông tin credential vào localStorage
      localStorage.setItem('current_credential_id', webAuthnResult.credentialId);
      localStorage.setItem('current_guardian_id', selectedGuardian.guardianId.toString());
      
      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi khôi phục");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Hiển thị các bước khác nhau dựa trên currentStep
  return (
    <Card className="w-full glass-premium shadow-xl border border-zinc-700/30 overflow-hidden">
      {/* Card header với hiệu ứng gradient */}
      <CardHeader className="border-b border-zinc-800/50 bg-gradient-to-br from-indigo-900/30 to-blue-900/30">
        <CardTitle className="text-xl text-blue-100 flex items-center">
          {currentStep === "search" && (
            <>
              <User className="mr-2 h-5 w-5 text-blue-400" />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-300 to-indigo-300">Xác thực tài khoản</span>
            </>
          )}
          {currentStep === "create" && (
            <>
              <Shield className="mr-2 h-5 w-5 text-indigo-400" />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 to-purple-300">Tạo thông tin xác thực mới</span>
            </>
          )}
        </CardTitle>
        <CardDescription className="text-gray-400">
          {currentStep === "search" && "Nhập thông tin của bạn để tìm kiếm và xác thực tài khoản"}
          {currentStep === "create" && "Tạo thông tin xác thực mới để khôi phục quyền truy cập"}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-6 pb-5">
        {currentStep === "search" && (
          <motion.div 
            className="space-y-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="space-y-2">
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">Tên Guardian</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-5 w-5 text-gray-500" />
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập tên guardian của bạn"
                  className="pl-10 bg-blue-950/20 border-blue-900/30 text-blue-100 placeholder:text-gray-500"
                  required
                />
              </div>
              <p className="text-xs text-gray-500">Đây là tên bạn đã đặt khi đăng ký làm guardian</p>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="recovery-phrase" className="block text-sm font-medium text-gray-300 mb-1">Mã khôi phục</label>
              <div className="relative">
                <KeySquare className="absolute left-3 top-2.5 h-5 w-5 text-gray-500" />
                <Input
                  id="recovery-phrase"
                  type="password"
                  value={recoveryPhrase}
                  onChange={(e) => setRecoveryPhrase(e.target.value)}
                  placeholder="Nhập mã khôi phục của bạn"
                  className="pl-10 bg-blue-950/20 border-blue-900/30 text-blue-100 placeholder:text-gray-500"
                required
              />
              </div>
              <p className="text-xs text-gray-500">Mã khôi phục được cung cấp khi bạn tạo guardian</p>
            </div>
            
            <Button 
              onClick={handleSearch}
              disabled={isLoading || !username || !recoveryPhrase}
              className="w-full gradient-blue-purple hover:opacity-90 shadow-lg flex items-center justify-center gap-2 h-11"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Đang xác thực...</span>
                </>
              ) : (
                <>
                  <span>Tiếp tục</span>
                  <ArrowRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </motion.div>
        )}
        
        {currentStep === "create" && !isSuccess && (
          <motion.div 
            className="space-y-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="p-4 rounded-lg bg-blue-900/10 border border-blue-800/30">
              <p className="text-blue-100 font-medium">Thông tin tài khoản:</p>
              {selectedGuardian && (
                <div className="mt-2 space-y-1 text-sm">
                  <p className="text-gray-300">
                    <span className="text-gray-500">Tên guardian:</span> {selectedGuardian.guardianName}
                  </p>
                  <p className="text-gray-300">
                    <span className="text-gray-500">Guardian ID:</span> {selectedGuardian.guardianId}
                  </p>
                  <p className="text-gray-300">
                    <span className="text-gray-500">Địa chỉ ví:</span> {selectedGuardian.multisigPDA.slice(0, 8)}...{selectedGuardian.multisigPDA.slice(-8)}
                  </p>
                </div>
              )}
              </div>
            
            <div className="py-2">
              <p className="text-gray-300 text-sm">
                Bạn sẽ tạo một thông tin xác thực mới để thay thế thông tin cũ.
                Thiết bị của bạn sẽ yêu cầu xác thực (vân tay, Face ID...).
              </p>
            </div>
            
            <div className="flex gap-3">
              <Button 
                variant="outline"
                onClick={() => onStepChange("search")}
                className="glass-light border-zinc-700/50 text-gray-300 hover:bg-zinc-800/30"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Quay lại
              </Button>
              <Button 
                onClick={handleRecover}
                disabled={isLoading}
                className="flex-1 gradient-cosmic hover:opacity-90 shadow-lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    <span>Khôi phục quyền truy cập</span>
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}
        
        {currentStep === "create" && isSuccess && (
          <motion.div 
            className="space-y-5 text-center py-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold text-green-400 mb-2">Khôi phục thành công!</h3>
              <p className="text-gray-300 text-sm">
                Đã khôi phục quyền truy cập của bạn. Bây giờ bạn có thể truy cập vào ví của mình.
              </p>
            </div>
            
            <Button 
              onClick={() => router.push("/(app)/dashboard")}
              className="glass-light border-zinc-700/30 text-blue-100 hover:bg-blue-900/30 transition-all duration-300 w-full"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Đi đến Dashboard
            </Button>
          </motion.div>
        )}
        
        {error && (
          <div className="mt-4 p-3 text-sm text-red-400 bg-red-900/20 border border-red-900/30 rounded-md">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 