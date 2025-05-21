import { PublicKey } from "@solana/web3.js";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  getGuardianData,
  updateGuardianStatus,
} from "@/lib/firebase/guardianService";
import { useWalletInfo } from "@/hooks/useWalletInfo";
import { GuardianData } from "@/types/guardian";
import { getGuardianPDA } from "@/utils/credentialUtils";

interface GuardianConfirmProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  guardian: GuardianData | null;
}

export function GuardianConfirm({
  isOpen,
  onClose,
  onConfirm,
  guardian,
}: GuardianConfirmProps) {
  const { multisigPDA } = useWalletInfo();
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const handleConfirm = async () => {
    try {
      setIsLoading(true);
      setLogs([]);

      if (!guardian?.inviteCode) {
        throw new Error("Guardian invite code not found");
      }

      // Check if multisigPDA exists
      if (!multisigPDA) {
        throw new Error("Multisig address not found");
      }

      // 1. Get guardian information
      const guardianData = await getGuardianData(guardian.inviteCode);

      if (!guardianData) {
        throw new Error("Guardian data not found");
      }

      // Check guardian status
      if (guardianData.status === "completed") {
        onConfirm();
        return;
      }

      // 2. Calculate guardian PDA using the utility function
      const multisigPublicKey = new PublicKey(multisigPDA);
      const guardianPDA = getGuardianPDA(
        multisigPublicKey,
        guardianData.guardianId,
      );

      // 3. Call API to add guardian
      const response = await fetch("/api/guardian/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          guardianId: guardianData.guardianId,
          guardianName: guardian?.guardianName || `Guardian ${guardianData.guardianId}`,
          recoveryHashIntermediate: guardianData.hashedRecoveryBytes,
          webauthnPubkey: guardianData.webauthnPublicKey,
          webauthnCredentialId: guardianData.webauthnCredentialId,
          multisigPDA: multisigPDA,
          isOwner: true,
          inviteCode: guardian.inviteCode
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add guardian");
      }

      const result = await response.json();

      // 4. Update status to completed
      await updateGuardianStatus(
        guardian.inviteCode,
        "completed",
        result.signature,
      );

      onConfirm();
    } catch (error) {
      console.error("Error confirming guardian:", error);
      setLogs((prev) => [
        ...prev,
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Confirm Guardian</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            ✕
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p>Are you sure you want to confirm this guardian?</p>
            <p className="text-muted-foreground text-sm">
              Guardian ID: {guardian?.guardianId}
            </p>
            <p className="text-muted-foreground text-sm">
              Invite Code: {guardian?.inviteCode}
            </p>

            <Button
              onClick={handleConfirm}
              disabled={
                isLoading || !multisigPDA || guardian?.status !== "ready"
              }
              variant="default"
              className="w-full"
            >
              {isLoading ? "Confirming..." : "Confirm Guardian"}
            </Button>

            {logs.length > 0 && (
              <div className="mt-4 max-h-40 overflow-y-auto rounded-md bg-gray-100 p-2 text-xs dark:bg-gray-800">
                {logs.map((log, index) => (
                  <div key={index} className="py-1">
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
