"use client";

import { ChevronDown, ChevronUp, Users, ExternalLink } from "lucide-react";
import type React from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  type: string;
  icon: React.ReactNode;
  address: string;
  label: string;
  time: string;
  status: string;
  statusColor: string;
  // Additional details for expanded view
  details: {
    author: string;
    createdOn: string;
    executedOn: string;
    transactionLink: string;
    results: {
      confirmed: number;
      rejected: number;
      threshold: string;
    };
  };
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
    details: {
      author: "9kcd...hw29",
      createdOn: "Mar 25, 2025, 11:53 AM",
      executedOn: "Mar 25, 2025, 11:54 AM",
      transactionLink: "5TnBx3QDxQC1...j2zeRAjjbW3K",
      results: {
        confirmed: 2,
        rejected: 0,
        threshold: "2/3",
      },
    },
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
    details: {
      author: "9kcd...hw29",
      createdOn: "Mar 25, 2025, 11:26 AM",
      executedOn: "Mar 25, 2025, 11:27 AM",
      transactionLink: "8RnAx7PDxQC1...k9zeRAjjbL2M",
      results: {
        confirmed: 3,
        rejected: 0,
        threshold: "2/3",
      },
    },
  },
];

export default function TransactionsPage() {
  const [expandedTransactions, setExpandedTransactions] = useState<
    Record<string, boolean>
  >({});

  const toggleTransaction = (id: string) => {
    setExpandedTransactions((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Transactions</h1>
      </div>

      <div className="space-y-2">
        <div className="text-muted-foreground text-sm">March 25, 2025</div>

        {transactions.map((transaction) => (
          <div key={transaction.id} className="transition-all duration-200">
            <Card
              className={cn(
                "hover:bg-accent/50 cursor-pointer p-4 transition-colors",
                expandedTransactions[transaction.id] && "rounded-b-none",
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">{transaction.icon}</div>
                  <div>
                    <div className="font-medium">{transaction.type}</div>
                    <div className="text-muted-foreground text-sm">
                      {transaction.label}
                    </div>
                  </div>
                  <div className="text-sm">{transaction.address}</div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-sm">{transaction.time}</div>
                    <div className="text-muted-foreground text-xs">Time</div>
                  </div>

                  <div className="text-right">
                    <div className={`text-sm ${transaction.statusColor}`}>
                      {transaction.status}
                    </div>
                    <div className="text-muted-foreground text-xs">Status</div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleTransaction(transaction.id)}
                    aria-label={
                      expandedTransactions[transaction.id]
                        ? "Collapse details"
                        : "Expand details"
                    }
                  >
                    {expandedTransactions[transaction.id] ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </Card>

            {expandedTransactions[transaction.id] && (
              <Card className="bg-muted/50 rounded-t-none border-t-0 p-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Info</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Author</span>
                        <span>{transaction.details.author}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Created on
                        </span>
                        <span>{transaction.details.createdOn}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Executed on
                        </span>
                        <span>{transaction.details.executedOn}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Transaction link
                        </span>
                        <a
                          href={`#${transaction.details.transactionLink}`}
                          className="flex items-center text-blue-500 hover:underline"
                        >
                          {transaction.details.transactionLink.substring(0, 15)}
                          ...
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Results</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-background rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-green-500">
                          {transaction.details.results.confirmed}
                        </div>
                        <div className="text-muted-foreground text-sm">
                          Confirmed
                        </div>
                      </div>
                      <div className="bg-background rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-red-500">
                          {transaction.details.results.rejected}
                        </div>
                        <div className="text-muted-foreground text-sm">
                          Rejected
                        </div>
                      </div>
                      <div className="bg-background rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold">
                          {transaction.details.results.threshold}
                        </div>
                        <div className="text-muted-foreground text-sm">
                          Threshold
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
