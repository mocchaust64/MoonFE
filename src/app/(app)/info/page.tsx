import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ExternalLink, Calendar } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalTrigger, ModalFooter } from "@/components/ui/modal"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export default function InfoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Info</h1>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Vault Info Card - Bên trái */}
        <Card className="p-6 bg-card/30">
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-gradient-to-br from-cyan-400 to-blue-500" />
              </Avatar>
              <div className="space-y-1 flex-1">
                <div className="flex items-start justify-between">
                  <div className="font-mono text-sm break-all pr-2">5byCFmkb9BLufpk4SxcfjGd6mRnUxuTawVxyCka7w9LJ</div>
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">N/A</div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground">Vault balance</div>
                <div className="text-2xl font-bold">$0.00</div>
              </div>

              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Created on</div>
                <div className="flex items-center justify-between rounded-md bg-muted/50 p-3">
                  <span className="text-sm">N/A</span>
                  <Button variant="ghost" size="icon" className="-mr-2">
                    <Calendar className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Multisig Account</div>
                <div className="flex items-center justify-between rounded-md bg-muted/50 p-3">
                  <span className="font-mono text-sm">5byCF****</span>
                  <Modal>
                    <ModalTrigger asChild>
                      <Button variant="ghost" className="-mr-2 underline hover:no-underline">
                        Show
                      </Button>
                    </ModalTrigger>
                    <ModalContent>
                      <ModalHeader>
                        <ModalTitle>Warning</ModalTitle>
                      </ModalHeader>
                      <div className="space-y-6 py-4">
                        <ul className="list-disc pl-6 space-y-4">
                          <li className="text-sm text-muted-foreground">
                            DO NOT set Multisig Account address as authority of your programs or send any kind of assets
                            to it.
                          </li>
                          <li className="text-sm text-muted-foreground">
                            ONLY Squad Vault address should be set as the owner of your assets/authorities. Multisig
                            Account address is used solely for CLI settings commands.
                          </li>
                          <li className="text-sm text-muted-foreground">
                            Sending assets or setting authority to the Multisig Account address will cause irreversible
                            loss of funds/assets.
                          </li>
                        </ul>
                        <div className="bg-muted/50 p-3 rounded-md">
                          <div className="text-sm text-muted-foreground">Multisig Account</div>
                          <div className="font-mono text-sm">5byCF****</div>
                        </div>
                        <div className="flex justify-between gap-4">
                          <Button variant="outline" className="w-1/2">
                            Back
                          </Button>
                          <Button className="w-1/2">I understand, show me</Button>
                        </div>
                      </div>
                    </ModalContent>
                  </Modal>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* 3 Card nhỏ bên phải */}
        <div className="grid grid-cols-1 gap-6">
          {/* Threshold Card */}
          <Card className="p-6 bg-card/30">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#1E3A8A]/20 p-2.5">
                  <svg
                    className="h-5 w-5 text-primary"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold">2/2</span>
                  <span className="text-sm text-muted-foreground">Threshold</span>
                </div>
              </div>
              <Modal>
                <ModalTrigger asChild>
                  <Button variant="secondary" size="sm" className="w-full bg-muted/50 hover:bg-muted">
                    Propose to change
                  </Button>
                </ModalTrigger>
                <ModalContent>
                  <ModalHeader>
                    <ModalTitle>Change threshold</ModalTitle>
                  </ModalHeader>
                  <div className="space-y-6 py-4">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-4">
                        <div className="h-10 w-10 rounded-xl bg-[#1E3A8A]/20 p-2.5">
                          <svg
                            className="h-5 w-5 text-primary"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                          </svg>
                        </div>
                        <div className="space-y-1">
                          <div className="text-sm">2/2</div>
                          <div className="text-sm text-muted-foreground">Current threshold</div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm">Confirmations needed (1)</div>
                        <div className="text-sm text-muted-foreground">Out of (2)</div>
                      </div>
                      <div className="px-3">
                        <Slider defaultValue={[1]} max={2} min={1} step={1} className="w-full" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Description</div>
                      <Input placeholder="Add transaction description" className="bg-muted/50 border-0" />
                    </div>
                  </div>
                  <ModalFooter className="flex gap-3">
                    <Button variant="outline" className="w-1/2">
                      Cancel
                    </Button>
                    <Button className="w-1/2">Initiate a transaction</Button>
                  </ModalFooter>
                </ModalContent>
              </Modal>
            </div>
          </Card>

          {/* Members Card */}
          <Card className="p-6 bg-card/30">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 p-2.5">
                <svg
                  className="h-5 w-5 text-amber-500"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold">2</span>
                <span className="text-sm text-muted-foreground">Members</span>
              </div>
            </div>
          </Card>

          {/* Settings Card */}
          <Card className="p-6 bg-card/30">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Settings</h2>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Explorer</div>
                <Select defaultValue="solana-fm">
                  <SelectTrigger className="w-full bg-muted/50 hover:bg-muted border-0">
                    <SelectValue placeholder="Select explorer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solana-fm">Solana FM</SelectItem>
                    <SelectItem value="solscan">Solscan</SelectItem>
                    <SelectItem value="solana-explorer">Solana Explorer</SelectItem>
                    <SelectItem value="xray">XRAY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

