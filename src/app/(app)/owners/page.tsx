"use client";

import { Pencil, Clipboard } from "lucide-react";
import { useState, useEffect } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useWalletStore } from "@/store/walletStore";

interface Guardian {
  id: string;
  address: string;
  name: string;
  isOwner: boolean;
}

export default function OwnersPage() {
  const { multisigAddress, guardianPDA } = useWalletStore();
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);

  // Check if store is hydrated
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    const fetchGuardians = async () => {
      if (!isHydrated) return;

      try {
        console.log("Current multisigAddress:", multisigAddress?.toString());
        console.log("Current guardianPDA:", guardianPDA?.toString());

        if (!multisigAddress || !guardianPDA) {
          setError("Chưa có ví được tạo");
          setIsLoading(false);
          return;
        }

        const placeholderGuardian: Guardian = {
          id: "1",
          address: guardianPDA.toString(),
          name: "Owner",
          isOwner: true,
        };

        setGuardians([placeholderGuardian]);
      } catch (error) {
        console.error("Error fetching guardians:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGuardians();
  }, [multisigAddress, guardianPDA, isHydrated]);

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="text-muted-foreground">
          Đang tải thông tin guardian...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="text-destructive">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Guardians</h1>
      </div>

      <Card className="overflow-hidden">
        <div className="divide-border divide-y rounded-lg">
          {guardians.map((guardian) => (
            <div
              key={guardian.id}
              className="hover:bg-muted/50 flex items-center justify-between p-3 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-gradient-to-br from-cyan-400 to-blue-500" />
                </Avatar>
                <div>
                  <div className="font-medium">{guardian.name}</div>
                  <div className="text-muted-foreground font-mono text-sm">
                    {guardian.address}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCopyAddress(guardian.address)}
                >
                  <Clipboard className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
