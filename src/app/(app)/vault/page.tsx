import { ArrowDown, ArrowUp, ChevronDown, Copy, User } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalTrigger,
} from "@/components/ui/modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
          <Modal>
            <ModalTrigger asChild>
              <Button variant="outline">
                <ArrowUp className="mr-2 h-4 w-4" />
                Send
              </Button>
            </ModalTrigger>
            <ModalContent>
              <ModalHeader>
                <ModalTitle>Send</ModalTitle>
              </ModalHeader>
              <div className="space-y-6 p-6">
                <div className="bg-accent/50 space-y-6 rounded-lg p-4">
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Recipient #1</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-muted-foreground text-sm">
                          Amount
                        </div>
                        <div className="relative">
                          <Input placeholder="Insert amount" />
                          <Button
                            variant="link"
                            className="absolute top-1/2 right-3 h-auto -translate-y-1/2 p-0 text-sm text-blue-500"
                          >
                            max
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-muted-foreground text-sm">
                          Asset
                        </div>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose asset" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sol">
                              <div className="flex items-center">
                                <Image
                                  src="/sol-logo.png"
                                  alt="SOL Logo"
                                  width={16}
                                  height={16}
                                  className="mr-2"
                                />
                                SOL
                              </div>
                            </SelectItem>
                            <SelectItem value="usdc">USDC</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-muted-foreground text-sm">To</div>
                      <div className="relative">
                        <Input placeholder="Insert address, .sol, .bonk, .abc, .poor or .glow name of the recipient" />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-1/2 right-2 -translate-y-1/2"
                        >
                          <User className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <Button variant="secondary" className="w-full">
                  + Add Recipient
                </Button>

                <div className="bg-accent/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-sm text-amber-500">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                    >
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                      <path d="M12 9v4" />
                      <path d="M12 17h.01" />
                    </svg>
                    In case of sending assets to unknown addresses or CEX
                    accounts, make sure to send a small test transaction first
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-muted-foreground text-sm">
                    Description
                  </div>
                  <Input
                    placeholder="Add transaction description"
                    className="bg-accent/50 border-0"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Button variant="outline" className="w-full">
                    Cancel
                  </Button>
                  <Button className="w-full">Send</Button>
                </div>
              </div>
            </ModalContent>
          </Modal>
          <Modal>
            <ModalTrigger asChild>
              <Button variant="default">
                <ArrowDown className="mr-2 h-4 w-4" />
                Deposit
              </Button>
            </ModalTrigger>
            <ModalContent>
              <ModalHeader>
                <ModalTitle>Deposit</ModalTitle>
              </ModalHeader>
              <div className="space-y-6 p-6">
                <div className="space-y-2">
                  <div className="text-muted-foreground text-sm">
                    From your wallet
                  </div>
                  <div className="bg-accent/50 flex items-center justify-between rounded-lg p-3">
                    <span className="font-mono text-sm">
                      AoNFGeyLgCPZff6QHPMP8s7m3pqqSsbecerf6U2GSbfW
                    </span>
                    <Button variant="ghost" size="icon" className="-mr-2">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-sm">Amount</div>
                    <div className="relative">
                      <Input placeholder="Insert amount" />
                      <Button
                        variant="link"
                        className="absolute top-1/2 right-3 h-auto -translate-y-1/2 p-0 text-sm text-blue-500"
                      >
                        max
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm">Asset</div>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose asset" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sol">
                          <div className="flex items-center">
                            <Image
                              src="/sol-logo.png"
                              alt="SOL Logo"
                              width={16}
                              height={16}
                              className="mr-2"
                            />
                            SOL
                          </div>
                        </SelectItem>
                        <SelectItem value="usdc">USDC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Button variant="outline" className="w-full">
                    Cancel
                  </Button>
                  <Button className="w-full">Deposit</Button>
                </div>
              </div>
            </ModalContent>
          </Modal>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
                  <div className="text-muted-foreground text-sm">
                    Vault balance
                  </div>
                  <div className="text-3xl font-bold">$0.00</div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Hidden</div>
                    <Button variant="ghost" size="sm">
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button variant="outline" className="w-full justify-between">
                    <span>Check your airdrops</span>
                    <span className="text-muted-foreground">
                      3 tokens available
                    </span>
                  </Button>
                </div>
              </Card>

              <div className="space-y-4">
                <div className="font-medium">Recent transactions</div>
                <div className="text-muted-foreground py-8 text-center text-sm">
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
                <div className="text-muted-foreground text-sm">
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
                <div className="mb-2 flex justify-between">
                  <div className="text-sm">You pay</div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm">
                      HALF
                    </Button>
                    <Button variant="ghost" size="sm">
                      MAX
                    </Button>
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
                          <Image
                            src="/sol-logo.png"
                            alt="SOL Logo"
                            width={16}
                            height={16}
                            className="mr-2"
                          />
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
                <div className="mb-2 text-sm">You receive</div>
                <div className="flex gap-2">
                  <Input type="number" placeholder="0" className="text-2xl" />
                  <Select defaultValue="usdc">
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="usdc">
                        <div className="flex items-center">
                          <Image
                            src="/usdc-logo.png"
                            alt="USDC Logo"
                            width={16}
                            height={16}
                            className="mr-2"
                          />
                          USDC
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="mb-2 text-sm">Slippage Tolerance</div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      0.1%
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      0.5%
                    </Button>
                    <Button variant="secondary" size="sm" className="flex-1">
                      1%
                    </Button>
                  </div>
                </div>

                <div>
                  <div className="text-muted-foreground mb-2 text-sm">
                    Description
                  </div>
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
