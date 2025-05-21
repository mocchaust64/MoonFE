import { useEffect, useState, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { TokenInfo, getTokenAccounts } from '@/utils/tokenListUtils';
import { Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
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
        <div className="w-8 h-8 sm:w-10 sm:h-10 relative">
          <div className="animate-ping absolute h-full w-full rounded-full bg-blue-500 opacity-20"></div>
          <div className="animate-spin relative rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium text-gray-400">Token Balances</h3>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 w-8 rounded-full hover:bg-zinc-800/80"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 text-gray-400 hover:text-blue-400 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      
      {tokens.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-zinc-900/60 rounded-xl border border-zinc-800/60 p-4 sm:p-5 flex flex-col items-center justify-center shadow-inner"
        >
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-zinc-800/60 mb-3 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
              <circle cx="8" cy="8" r="6"></circle>
              <path d="M18.09 10.37A6 6 0 1 1 10.34 18.13"></path>
              <path d="m7 6 4 4"></path>
              <path d="m7 10 4-4"></path>
            </svg>
          </div>
          <p className="text-gray-300 font-medium text-sm">No tokens found</p>
          <p className="text-gray-500 text-xs mt-1">Your tokens will appear here</p>
        </motion.div>
      ) : (
        tokens.map((token, index) => (
          <motion.div
            key={token.mint}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="group"
          >
            <div className="bg-zinc-900/60 rounded-lg border border-zinc-800/60 p-2.5 sm:p-3.5 transition-all duration-300 hover:shadow-md hover:border-zinc-700/60 hover:bg-zinc-900/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <div 
                    className={`h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-medium shadow-md ${getTokenColor(token.symbol || '')}`}
                  >
                    {token.symbol?.[0] || token.mint.slice(0, 2)}
                  </div>
                  <div>
                    <div className="font-medium text-white text-sm sm:text-base">
                      {token.symbol || 'Unknown Token'}
                    </div>
                    <div className="text-[10px] sm:text-xs text-gray-400 font-mono">
                      {`${token.mint.slice(0, 4)}...${token.mint.slice(-4)}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <div className="text-right">
                    <div className="font-medium text-white text-sm sm:text-base">
                      {token.balance.toLocaleString(undefined, {
                        maximumFractionDigits: 6,
                      })}
                    </div>
                  </div>
                  <div className="flex space-x-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 sm:h-7 sm:w-7 rounded-full hover:bg-zinc-800/80"
                      onClick={() => handleCopyAddress(token.mint)}
                    >
                      <Copy className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-gray-400 hover:text-blue-400" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 sm:h-7 sm:w-7 rounded-full hover:bg-zinc-800/80"
                      onClick={() => openExplorer(token.mint)}
                    >
                      <ExternalLink className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-gray-400 hover:text-blue-400" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))
      )}
    </div>
  );
}

// Helper function to get token color based on symbol
function getTokenColor(symbol: string): string {
  const colors: Record<string, string> = {
    'USDC': 'bg-gradient-to-br from-blue-600 to-blue-700',
    'USDT': 'bg-gradient-to-br from-green-600 to-green-700',
    'BTC': 'bg-gradient-to-br from-orange-500 to-orange-700',
    'ETH': 'bg-gradient-to-br from-purple-500 to-purple-700',
    'SOL': 'bg-gradient-to-br from-blue-400 to-blue-600',
    'BONK': 'bg-gradient-to-br from-yellow-500 to-yellow-700',
    'RAY': 'bg-gradient-to-br from-blue-600 to-indigo-700',
    'SRM': 'bg-gradient-to-br from-blue-700 to-blue-900',
  };
  
  return colors[symbol] || 'bg-gradient-to-br from-zinc-600 to-zinc-700';
} 