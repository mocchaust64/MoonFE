import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDown, ArrowUp, ChevronDown, Copy } from "lucide-react";

export default function VaultPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Vault</h1>
        <div className="flex gap-2">
          <Button variant="outline">
            <ArrowUp className="mr-2 h-4 w-4" />
            Off-ramp
          </Button>
          <Button variant="outline">
            <ArrowUp className="mr-2 h-4 w-4" />
            Send
          </Button>
          <Button variant="default">
            <ArrowDown className="mr-2 h-4 w-4" />
            Deposit
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Assets */}
        <div className="space-y-6">
          <Tabs defaultValue="assets">
            <TabsList>
              <TabsTrigger value="assets">Assets</TabsTrigger>
              <TabsTrigger value="nft">NFT</TabsTrigger>
            </TabsList>
            <TabsContent value="assets" className="space-y-4">
              <Card className="p-6">
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">Vault balance</div>
                  <div className="text-3xl font-bold">$0.00</div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Hidden</div>
                    <Button variant="ghost" size="sm">
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button variant="outline" className="w-full justify-between">
                    <span>Check your airdrops</span>
                    <span className="text-muted-foreground">3 tokens available</span>
                  </Button>
                </div>
              </Card>

              <div className="space-y-4">
                <div className="font-medium">Recent transactions</div>
                <div className="text-sm text-muted-foreground text-center py-8">
                  No transactions yet
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Contacts</div>
                  <Button variant="ghost" size="icon">
                    <span className="text-xl">+</span>
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">
                  No contacts yet
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - Swap */}
        <Card className="p-6">
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <span>Swap by</span>
              <span className="font-medium">Orca</span>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <div className="text-sm">You pay</div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm">HALF</Button>
                    <Button variant="ghost" size="sm">MAX</Button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input type="number" placeholder="0" className="text-2xl" />
                  <Select defaultValue="sol">
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sol">
                        <div className="flex items-center">
                          <img src="/sol-logo.png" alt="SOL" className="h-4 w-4 mr-2" />
                          SOL
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-center">
                <Button variant="ghost" size="icon" className="rounded-full">
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>

              <div>
                <div className="text-sm mb-2">You receive</div>
                <div className="flex gap-2">
                  <Input type="number" placeholder="0" className="text-2xl" />
                  <Select defaultValue="usdc">
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="usdc">
                        <div className="flex items-center">
                          <img src="/usdc-logo.png" alt="USDC" className="h-4 w-4 mr-2" />
                          USDC
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-sm mb-2">Slippage Tolerance</div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1">0.1%</Button>
                    <Button variant="outline" size="sm" className="flex-1">0.5%</Button>
                    <Button variant="secondary" size="sm" className="flex-1">1%</Button>
                  </div>
                </div>

                <div>
                  <div className="text-sm text-muted-foreground mb-2">Description</div>
                  <Input placeholder="Leave a description" />
                </div>

                <Button className="w-full" size="lg">
                  Swap
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
