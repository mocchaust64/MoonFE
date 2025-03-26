import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <div className="container mx-auto px-4 py-16">
        <nav className="flex items-center justify-between mb-16">
          <div className="text-2xl font-bold">🌙 Moon Wallet</div>
          <Link href="/dashboard">
            <Button variant="outline">Launch App</Button>
          </Link>
        </nav>

        <main className="flex flex-col items-center text-center gap-8 py-20">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight max-w-3xl">
            Your Gateway to{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-cyan-400">
              Web3
            </span>{" "}
            Finance
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl">
            Secure, simple, and powerful. Manage your digital assets with confidence using Moon Wallet.
          </p>

          <div className="flex gap-4 mt-8">
            <Link href="/dashboard">
              <Button size="lg">
                Get Started
              </Button>
            </Link>
            <Link href="https://docs.moonwallet.app" target="_blank">
              <Button variant="outline" size="lg">
                Learn More
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20">
            <div className="p-6 rounded-lg border bg-card">
              <h3 className="text-xl font-semibold mb-2">Secure Storage</h3>
              <p className="text-muted-foreground">
                Your assets are protected with industry-leading security measures
              </p>
            </div>
            <div className="p-6 rounded-lg border bg-card">
              <h3 className="text-xl font-semibold mb-2">Multi-Chain Support</h3>
              <p className="text-muted-foreground">
                Support for multiple blockchains and tokens in one place
              </p>
            </div>
            <div className="p-6 rounded-lg border bg-card">
              <h3 className="text-xl font-semibold mb-2">DeFi Integration</h3>
              <p className="text-muted-foreground">
                Direct access to decentralized finance protocols
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
