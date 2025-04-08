"use client";

import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWalletInfo } from "@/hooks/useWalletInfo";

export default function DashboardPage() {
  const { balance, threshold, guardianCount, isLoading, error } =
    useWalletInfo();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-0">
          <h1 className="text-xl font-bold md:text-2xl">Dashboard</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled
              className="flex-1 md:flex-auto"
            >
              <ArrowUp className="mr-2 h-4 w-4" />
              Send
            </Button>
            <Button
              variant="default"
              size="sm"
              disabled
              className="flex-1 md:flex-auto"
            >
              <ArrowDown className="mr-2 h-4 w-4" />
              Deposit
            </Button>
          </div>
        </div>
        <Card className="p-4">
          <div className="text-muted-foreground text-center">Loading...</div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-0">
          <h1 className="text-xl font-bold md:text-2xl">Dashboard</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled
              className="flex-1 md:flex-auto"
            >
              <ArrowUp className="mr-2 h-4 w-4" />
              Send
            </Button>
            <Button
              variant="default"
              size="sm"
              disabled
              className="flex-1 md:flex-auto"
            >
              <ArrowDown className="mr-2 h-4 w-4" />
              Deposit
            </Button>
          </div>
        </div>
        <Card className="p-4">
          <div className="text-destructive text-center">{error.message}</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-0">
        <h1 className="text-xl font-bold md:text-2xl">Dashboard</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 md:flex-auto">
            <ArrowUp className="mr-2 h-4 w-4" />
            Send
          </Button>
          <Button variant="default" size="sm" className="flex-1 md:flex-auto">
            <ArrowDown className="mr-2 h-4 w-4" />
            Deposit
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Left Column - Assets */}
        <Tabs defaultValue="assets" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="assets" className="flex-1">
              Assets
            </TabsTrigger>
            <TabsTrigger value="nft" className="flex-1">
              NFT
            </TabsTrigger>
          </TabsList>
          <TabsContent value="assets">
            <Card className="p-4">
              <div className="space-y-2">
                <div className="text-muted-foreground text-sm">
                  Vault balance
                </div>
                <div className="text-muted-foreground text-sm">
                  {balance.toFixed(4)} SOL
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Right Column - Info Cards */}
        <div className="space-y-4">
          {/* Transactions Card */}
          <Link href="/transactions">
            <Card className="hover:bg-muted/50 p-4 transition-colors">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Transactions</h2>
                <ChevronRight className="text-muted-foreground h-5 w-5" />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                  <span className="text-muted-foreground text-sm">Active</span>
                  <span className="text-lg font-medium">0</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                  <span className="text-muted-foreground text-sm">
                    Ready for execution
                  </span>
                  <span className="text-lg font-medium">1</span>
                </div>
              </div>
            </Card>
          </Link>

          {/* Info Card */}
          <Link href="/info">
            <Card className="hover:bg-muted/50 p-4 transition-colors">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Info</h2>
                <ChevronRight className="text-muted-foreground h-5 w-5" />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="text-cyan-500">⚡</div>
                    <span className="text-muted-foreground text-sm">
                      Threshold
                    </span>
                  </div>
                  <span className="text-sm font-medium">
                    {threshold}/{guardianCount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="text-yellow-500">👥</div>
                    <span className="text-muted-foreground text-sm">
                      Owners
                    </span>
                  </div>
                  <span className="text-sm font-medium">{guardianCount}</span>
                </div>
              </div>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
