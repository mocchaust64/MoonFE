import { useEffect, useState, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { TokenInfo, getTokenAccounts } from '@/utils/tokenListUtils';
import { Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { connection } from "@/lib/solana";
import { toast } from 'sonner';

interface TokenListProps {
  walletAddress: PublicKey;
}

export function TokenList({ walletAddress }: TokenListProps) {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchTokens = useCallback(async (showToast = false) => {
    if (!walletAddress) return;
    
    try {
      setIsRefreshing(true);
      const tokenInfos = await getTokenAccounts(connection, walletAddress);
      setTokens(tokenInfos);
      if (showToast) {
        toast.success("Token balances updated");
      }
    } catch (error) {
      console.error('Error fetching tokens:', error);
      if (showToast) {
        toast.error("Failed to update token balances");
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [walletAddress]);

  // Initial fetch khi component mount
  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  const handleRefresh = () => {
    fetchTokens(true);
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success("Token address copied to clipboard");
  };

  const openExplorer = (address: string) => {
    window.open(`https://explorer.solana.com/address/${address}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium text-muted-foreground">Token Balances</h3>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 w-7 rounded-full"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      
      {tokens.length === 0 ? (
        <div className="text-muted-foreground text-center py-4 text-sm">
          No tokens found
        </div>
      ) : (
        <div className="space-y-2">
          {tokens.map((token) => (
            <div
              key={token.mint}
              className="group flex items-center justify-between p-2 rounded hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-2">
                <div 
                  className={`h-6 w-6 rounded-full flex items-center justify-center text-white text-xs font-medium ${getTokenColor(token.symbol || '')}`}
                >
                  {token.symbol?.[0] || token.mint.slice(0, 2)}
                </div>
                <div>
                  <div className="font-medium text-sm">
                    {token.symbol || 'Unknown Token'}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {`${token.mint.slice(0, 4)}...${token.mint.slice(-4)}`}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <div className="font-medium text-sm">
                    {token.balance.toLocaleString(undefined, {
                      maximumFractionDigits: 6,
                    })}
                  </div>
                </div>
                <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 rounded-full"
                    onClick={() => handleCopyAddress(token.mint)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 rounded-full"
                    onClick={() => openExplorer(token.mint)}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper function to get token color based on symbol
function getTokenColor(symbol: string): string {
  const colors: Record<string, string> = {
    'USDC': 'bg-blue-500',
    'USDT': 'bg-green-500',
    'BTC': 'bg-orange-500',
    'ETH': 'bg-purple-500',
    'SOL': 'bg-blue-500',
    'BONK': 'bg-yellow-500',
    'RAY': 'bg-indigo-500',
    'SRM': 'bg-blue-600',
  };
  
  return colors[symbol] || 'bg-gray-500';
} 