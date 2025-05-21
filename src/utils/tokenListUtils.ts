import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';

export interface TokenInfo {
  mint: string;
  balance: number;
  decimals: number;
  symbol?: string;
  name?: string;
}

export async function getTokenAccounts(connection: Connection, walletAddress: PublicKey): Promise<TokenInfo[]> {
  try {
    // Sử dụng phương thức getParsedTokenAccountsByOwner thay vì getTokenAccountsByOwner
    // API này trả về dữ liệu đã được parse, bao gồm cả balance và decimals
    const response = await connection.getParsedTokenAccountsByOwner(
      walletAddress,
      { programId: TOKEN_PROGRAM_ID }
    );

    // Xử lý thông tin trực tiếp từ dữ liệu đã được parse
    const tokenInfos = response.value.map((item) => {
      const accountInfo = item.account.data.parsed.info;
      const mint = accountInfo.mint;
      const amount = accountInfo.tokenAmount.amount;
      const decimals = accountInfo.tokenAmount.decimals;
      const balance = Number(amount) / Math.pow(10, decimals);

      return {
        mint,
        balance,
        decimals,
      };
    });

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
    
    // Sử dụng getParsedAccountInfo thay vì gọi getAccount và getMint riêng biệt
    const accountInfo = await connection.getParsedAccountInfo(tokenAccount);
    
    if (accountInfo.value && 'parsed' in accountInfo.value.data) {
      const parsedData = accountInfo.value.data.parsed;
      const tokenAmount = parsedData.info.tokenAmount;
      return Number(tokenAmount.amount) / Math.pow(10, tokenAmount.decimals);
    }
    
    return 0;
  } catch (error) {
    console.error('Error fetching token balance:', error);
    return 0;
  }
} 