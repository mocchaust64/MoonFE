"use client";

import { ArrowDown, ArrowUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWalletStore } from "@/store/walletStore";

export default function DashboardPage() {
  const { pdaBalance } = useWalletStore();

  const balance = pdaBalance || 0;
  const usdBalance = balance * 72.45;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <ArrowUp className="mr-2 h-4 w-4" />
            Send
          </Button>
          <Button variant="default" size="sm">
            <ArrowDown className="mr-2 h-4 w-4" />
            Deposit
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Left Column - Assets */}
        <div>
          <Tabs defaultValue="assets">
            <TabsList>
              <TabsTrigger value="assets">Assets</TabsTrigger>
              <TabsTrigger value="nft">NFT</TabsTrigger>
            </TabsList>
            <TabsContent value="assets">
              <Card className="p-4">
                <div className="space-y-2">
                  <div className="text-muted-foreground text-sm">
                    Vault balance
                  </div>
                  <div className="text-2xl font-bold">
                    ${usdBalance.toFixed(2)}
                  </div>
                  <div className="text-muted-foreground text-sm">
                    {balance.toFixed(4)} SOL
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
