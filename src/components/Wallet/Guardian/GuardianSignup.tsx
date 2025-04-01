"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  saveGuardianData,
  getInvitation,
} from "@/lib/firebase/guardianService";
import { useWalletStore } from "@/store/walletStore";
import { compressPublicKey } from "@/utils/bufferUtils";
import { hashRecoveryPhrase } from "@/utils/guardianUtils";
import { createWebAuthnCredential } from "@/utils/webauthnUtils";

// Định nghĩa schema validation
const formSchema = z.object({
  guardianName: z.string().min(2, {
    message: "Guardian name must be at least 2 characters.",
  }),
  recoveryPhrase: z.string().min(8, {
    message: "Recovery phrase must be at least 8 characters.",
  }),
});

export interface GuardianSignupProps {
  inviteCode: string;
  onComplete?: () => void;
}

export function GuardianSignup({
  inviteCode,
  onComplete,
}: GuardianSignupProps) {
  // Hooks và states
  const { multisigAddress } = useWalletStore();
  const [status, setStatus] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [guardianId, setGuardianId] = useState<number | null>(null);

  // 1. Define form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      guardianName: "",
      recoveryPhrase: "",
    },
  });

  // Tải dữ liệu lời mời khi component mount
  useEffect(() => {
    const loadInvitation = async () => {
      try {
        setStatus("Đang tải thông tin lời mời...");
        const invitation = await getInvitation(inviteCode);

        if (!invitation) {
          setStatus(
            "Không tìm thấy thông tin lời mời. Vui lòng kiểm tra lại mã mời.",
          );
          return;
        }

        setGuardianId(invitation.guardianId);
        setStatus(
          `Đã tải thông tin lời mời. Guardian ID: ${invitation.guardianId}`,
        );
      } catch (error) {
        console.error("Lỗi khi tải thông tin lời mời:", error);
        setStatus("Có lỗi xảy ra khi tải thông tin lời mời");
      }
    };

    loadInvitation();
  }, [inviteCode]);

  // 2. Define submit handler
  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      if (!guardianId) {
        setStatus("Không thể đăng ký: Không tìm thấy guardian ID từ lời mời");
        return;
      }

      setIsLoading(true);
      setStatus(`Đang đăng ký với Guardian ID: ${guardianId}...`);

      // 1. Tạo WebAuthn credential
      setStatus(`Đang tạo WebAuthn credential...`);
      const webAuthnResult = await createWebAuthnCredential(
        values.guardianName,
        "Moon Wallet Guardian",
      );

      // 2. Hash recovery phrase
      setStatus(`Đang hash recovery phrase...`);
      const hashedRecoveryBytes = await hashRecoveryPhrase(
        values.recoveryPhrase,
      );

      // 3. Lưu vào Firebase
      setStatus(`Đang lưu thông tin guardian...`);
      await saveGuardianData({
        inviteCode,
        guardianName: values.guardianName,
        guardianId: guardianId,
        multisigAddress: multisigAddress?.toString() || "",
        hashedRecoveryBytes: Array.from(hashedRecoveryBytes),
        webauthnCredentialId: webAuthnResult.credentialId,
        webauthnPublicKey: Array.from(
          compressPublicKey(Buffer.from(webAuthnResult.publicKey, "hex")),
        ),
        status: "ready",
      });

      setStatus(`Đã đăng ký thành công với Guardian ID: ${guardianId}`);
      setIsLoading(false);
      onComplete?.();
    } catch (error) {
      console.error("Error registering guardian:", error);
      setStatus(
        `Lỗi: ${error instanceof Error ? error.message : "Không xác định"}`,
      );
      setIsLoading(false);
      throw error;
    }
  }

  return (
    <Card className="w-full max-w-md p-6">
      <CardHeader>
        <CardTitle>Register as Guardian</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="guardianName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Guardian Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="recoveryPhrase"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recovery Phrase</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {status && (
              <div className="bg-secondary/50 mt-2 rounded p-2 text-sm">
                {status}
              </div>
            )}

            <Button
              type="submit"
              disabled={form.formState.isSubmitting || isLoading || !guardianId}
              className="w-full"
            >
              {form.formState.isSubmitting || isLoading
                ? "Processing..."
                : "Register"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
