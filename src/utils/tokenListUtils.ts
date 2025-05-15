import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAccount, getAssociatedTokenAddress, getMint } from '@solana/spl-token';

export interface TokenInfo {
  mint: string;
  balance: number;
  decimals: number;
  symbol?: string;
  name?: string;
}

export async function getTokenAccounts(connection: Connection, walletAddress: PublicKey): Promise<TokenInfo[]> {
  try {
    // Lấy tất cả token accounts của ví
    const response = await connection.getTokenAccountsByOwner(
      walletAddress,
      { programId: TOKEN_PROGRAM_ID }
    );

    // Xử lý thông tin từ mỗi token account
    const tokenInfos = await Promise.all(
      response.value.map(async (tokenAccount) => {
        // Parse account data
        const accountInfo = await getAccount(connection, tokenAccount.pubkey);
        const mintInfo = await getMint(connection, accountInfo.mint);
        
        const balance = Number(accountInfo.amount) / Math.pow(10, mintInfo.decimals);
        
        return {
          mint: accountInfo.mint.toBase58(),
          balance,
          decimals: mintInfo.decimals,
          // Có thể thêm symbol và name sau khi tích hợp với token metadata
        };
      })
    );

    // Lọc ra những token có số dư > 0
    return tokenInfos.filter(token => token.balance > 0);
  } catch (error) {
    console.error('Error fetching token accounts:', error);
    return [];
  }
}

export async function getTokenBalance(
  connection: Connection,
  walletAddress: PublicKey,
  tokenMint: PublicKey
): Promise<number> {
  try {
    const tokenAccount = await getAssociatedTokenAddress(tokenMint, walletAddress);
    const account = await getAccount(connection, tokenAccount);
    const mintInfo = await getMint(connection, tokenMint);
    return Number(account.amount) / Math.pow(10, mintInfo.decimals);
  } catch (error) {
    console.error('Error fetching token balance:', error);
    return 0;
  }
} 