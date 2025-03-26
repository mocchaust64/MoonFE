import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, Users } from "lucide-react";

interface Transaction {
  id: string;
  type: string;
  icon: React.ReactNode;
  address: string;
  label: string;
  time: string;
  status: string;
  statusColor: string;
}

const transactions: Transaction[] = [
  {
    id: "1",
    type: "Remove Owner",
    icon: <Users className="h-5 w-5 text-red-500" />,
    address: "9oEc...iPyN",
    label: "Owner",
    time: "11:54 AM",
    status: "Executed",
    statusColor: "text-green-500",
  },
  {
    id: "2",
    type: "Add Owner",
    icon: <Users className="h-5 w-5 text-green-500" />,
    address: "9oEc...iPyN",
    label: "New owner",
    time: "11:27 AM",
    status: "Executed",
    statusColor: "text-green-500",
  },
];

export default function TransactionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Transactions</h1>
      </div>

      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">
          March 25, 2025
        </div>

        {transactions.map((transaction) => (
          <Card
            key={transaction.id}
            className="p-4 hover:bg-accent/50 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  {transaction.icon}
                </div>
                <div>
                  <div className="font-medium">{transaction.type}</div>
                  <div className="text-sm text-muted-foreground">
                    {transaction.label}
                  </div>
                </div>
                <div className="text-sm">
                  {transaction.address}
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-sm">
                    {transaction.time}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Time
                  </div>
                </div>

                <div className="text-right">
                  <div className={`text-sm ${transaction.statusColor}`}>
                    {transaction.status}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Status
                  </div>
                </div>

                <Button variant="ghost" size="icon">
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
} 