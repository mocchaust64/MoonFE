import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pencil, Clipboard, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
  ModalTrigger,
} from "@/components/ui/modal";

interface Owner {
  id: string;
  address: string;
  avatar: string;
}

const owners: Owner[] = [
  {
    id: "1",
    address: "9kcd4SdcXA25KFcCgg7VRPS4J461aHfLMYsguWJwhw29",
    avatar: "bg-gradient-to-br from-cyan-400 to-blue-500"
  },
  {
    id: "2",
    address: "AoNFGeyLgCPZff6QHPMP8s7m3pqqSsbecerf6U2GSbfW",
    avatar: "bg-gradient-to-br from-blue-400 to-purple-500"
  }
];

export default function OwnersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Owners</h1>
        <Modal>
          <ModalTrigger asChild>
            <Button>
              <span className="mr-2">+</span>
              Add owner
            </Button>
          </ModalTrigger>
          <ModalContent>
            <ModalHeader>
              <ModalTitle>Add a member by public key</ModalTitle>
            </ModalHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Public key</Label>
                <Input 
                  placeholder="Insert public key"
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input 
                  placeholder="Add transaction description"
                  className="bg-muted"
                />
              </div>
            </div>
            <ModalFooter>
              <Button variant="outline" className="mr-2">
                Cancel
              </Button>
              <Button>
                Initiate a transaction
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </div>

      <Card className="overflow-hidden">
        <div className="divide-y divide-border rounded-lg">
          {owners.map((owner) => (
            <div
              key={owner.id}
              className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className={owner.avatar} />
                </Avatar>
                <span className="font-mono text-sm">{owner.address}</span>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon">
                  <Clipboard className="h-4 w-4" />
                </Button>
                <Modal>
                  <ModalTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </ModalTrigger>
                  <ModalContent>
                    <ModalHeader>
                      <ModalTitle>Remove a member by public key</ModalTitle>
                    </ModalHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Public key</Label>
                        <div className="rounded-md bg-muted p-3">
                          <span className="font-mono text-sm">{owner.address}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input 
                          placeholder="Add transaction description"
                          className="bg-muted"
                        />
                      </div>
                    </div>
                    <ModalFooter>
                      <Button variant="outline" className="mr-2">
                        Cancel
                      </Button>
                      <Button variant="destructive">
                        Initiate a transaction
                      </Button>
                    </ModalFooter>
                  </ModalContent>
                </Modal>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
} 