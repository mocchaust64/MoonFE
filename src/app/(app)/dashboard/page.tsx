import { Card } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-6">
          <h2 className="font-semibold">Total Balance</h2>
          <p className="mt-2 text-3xl font-bold">$0.00</p>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold">Total Assets</h2>
          <p className="mt-2 text-3xl font-bold">0</p>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold">NFTs</h2>
          <p className="mt-2 text-3xl font-bold">0</p>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold">Transactions</h2>
          <p className="mt-2 text-3xl font-bold">0</p>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        <div className="text-center text-muted-foreground py-8">
          No recent activity
        </div>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <p className="text-muted-foreground">Send, receive, or swap tokens</p>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Network Status</h2>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500"></div>
            <span>Connected to Mainnet</span>
          </div>
        </Card>
      </div>
    </div>
  );
} 