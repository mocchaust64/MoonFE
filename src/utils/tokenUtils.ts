import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction, 
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import BN from "bn.js";

/**
 * Tìm Associated Token Account cho một ví và một token mint
 * @param walletAddress Địa chỉ ví
 * @param tokenMint Địa chỉ của token mint
 * @returns Địa chỉ của Associated Token Account
 */
export const getTokenAccountAddress = async (
  walletAddress: PublicKey,
  tokenMint: PublicKey
): Promise<PublicKey> => {
  try {
    // Thử lấy ATA thông thường trước
    try {
      return await getAssociatedTokenAddress(
        tokenMint,
        walletAddress,
        true, // allowOwnerOffCurve = true để cho phép PDA
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
    } catch (e) {
      if (e instanceof Error && e.message.includes('TokenOwnerOffCurveError')) {
        // Nếu là PDA, tính token account theo cách khác
        const [tokenAccount] = PublicKey.findProgramAddressSync(
          [
            walletAddress.toBuffer(),
            TOKEN_PROGRAM_ID.toBuffer(),
            tokenMint.toBuffer(),
          ],
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        return tokenAccount;
      }
      throw e;
    }
  } catch (error) {
    console.error('Error in getTokenAccountAddress:', error);
    throw new Error(`Không thể tạo địa chỉ token account: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Kiểm tra xem token account có tồn tại không
 * @param connection Connection đến Solana
 * @param tokenAccount Địa chỉ token account
 * @returns true nếu tồn tại, false nếu không
 */
export const doesTokenAccountExist = async (
  connection: Connection,
  tokenAccount: PublicKey
): Promise<boolean> => {
  try {
    const accountInfo = await connection.getAccountInfo(tokenAccount);
    return accountInfo !== null;
  } catch (error) {
    console.error("Error checking token account:", error);
    return false;
  }
};

/**
 * Tạo instruction để tạo Associated Token Account mới
 * @param payer Người trả phí giao dịch
 * @param owner Chủ sở hữu của token account
 * @param tokenMint Địa chỉ của token mint
 * @returns TransactionInstruction để tạo token account
 */
export const createTokenAccountInstruction = async (
  payer: PublicKey,
  owner: PublicKey,
  tokenMint: PublicKey
): Promise<TransactionInstruction> => {
  try {
    const associatedTokenAccount = await getTokenAccountAddress(owner, tokenMint);
    
    return createAssociatedTokenAccountInstruction(
      payer,
      associatedTokenAccount,
      owner,
      tokenMint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
  } catch (error) {
    console.error('Error in createTokenAccountInstruction:', error);
    throw new Error(`Không thể tạo instruction cho token account: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Tìm hoặc tạo token accounts cho giao dịch token
 * @param connection Connection đến Solana
 * @param payer Người trả phí giao dịch
 * @param multisigAddress Địa chỉ ví multisig
 * @param destinationAddress Địa chỉ người nhận
 * @param tokenMint Địa chỉ của token mint
 * @returns Transaction chứa các instructions để tạo token accounts nếu cần và địa chỉ của các token accounts
 */
export const findOrCreateTokenAccounts = async (
  connection: Connection,
  payer: PublicKey,
  multisigAddress: PublicKey,
  destinationAddress: PublicKey,
  tokenMint: PublicKey
): Promise<{
  transaction: Transaction;
  fromTokenAccount: PublicKey;
  toTokenAccount: PublicKey;
}> => {
  console.log('Starting findOrCreateTokenAccounts...');
  console.log('Payer:', payer.toString());
  console.log('Multisig:', multisigAddress.toString());
  console.log('Destination:', destinationAddress.toString());
  console.log('Token Mint:', tokenMint.toString());

  const transaction = new Transaction();
  
  try {
    // Tìm token account của multisig wallet
    console.log('Finding multisig token account...');
    const fromTokenAccount = await getTokenAccountAddress(multisigAddress, tokenMint);
    console.log('Multisig token account:', fromTokenAccount.toString());
    
    // Kiểm tra token account của multisig
    console.log('Checking multisig token account info...');
    const fromAccountInfo = await connection.getAccountInfo(fromTokenAccount);
    if (!fromAccountInfo) {
      throw new Error(`Token account không tồn tại cho ví multisig: ${fromTokenAccount.toString()}`);
    }
    
    // Kiểm tra số dư của token account
    console.log('Checking token balance...');
    try {
      const fromAccountBalance = await connection.getTokenAccountBalance(fromTokenAccount);
      console.log('Token balance:', fromAccountBalance.value.uiAmount);
      if (!fromAccountBalance.value.uiAmount || fromAccountBalance.value.uiAmount <= 0) {
        throw new Error(`Số dư token không đủ: ${fromAccountBalance.value.uiAmount}`);
      }
    } catch (balanceError) {
      throw new Error(`Lỗi khi kiểm tra số dư token: ${balanceError instanceof Error ? balanceError.message : 'Unknown error'}`);
    }
    
    // Tìm token account của destination
    console.log('Finding destination token account...');
    const toTokenAccount = await getTokenAccountAddress(destinationAddress, tokenMint);
    console.log('Destination token account:', toTokenAccount.toString());
    
    try {
      // Kiểm tra xem toTokenAccount có tồn tại không
      console.log('Checking destination token account...');
      const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
      
      if (!toAccountInfo) {
        console.log('Destination token account does not exist, creating new one...');
        // Tạo mới ATA nếu chưa tồn tại
        const createToAccountIx = await createTokenAccountInstruction(
          payer,
          destinationAddress,
          tokenMint
        );
        transaction.add(createToAccountIx);
        console.log('Added create account instruction');
      } else {
        console.log('Destination token account exists, checking if it is ATA...');
        // Kiểm tra xem account có phải là ATA không
        const isATA = await isAssociatedTokenAccount(
          connection,
          toTokenAccount,
          destinationAddress,
          tokenMint
        );
        
        if (!isATA) {
          throw new Error(`Token account ${toTokenAccount.toString()} không phải là Associated Token Account cho ví ${destinationAddress.toString()}`);
        }
        console.log('Confirmed destination account is ATA');
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Lỗi khi kiểm tra/tạo token account cho người nhận: ${error.message}`);
      }
      throw error;
    }
    
    return {
      transaction,
      fromTokenAccount,
      toTokenAccount
    };
  } catch (error) {
    console.error('Error in findOrCreateTokenAccounts:', error);
    if (error instanceof Error) {
      throw new Error(`Lỗi khi tìm/tạo token accounts: ${error.message}`);
    }
    throw error;
  }
};

// Hàm helper để kiểm tra xem một account có phải là ATA không
async function isAssociatedTokenAccount(
  connection: Connection,
  tokenAccount: PublicKey,
  owner: PublicKey,
  mint: PublicKey
): Promise<boolean> {
  try {
    const expectedATA = await getAssociatedTokenAddress(
      mint,
      owner,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    return tokenAccount.equals(expectedATA);
  } catch (error) {
    console.error("Error checking ATA:", error);
    return false;
  }
}

/**
 * Lấy số decimal của token
 * @param connection Connection đến Solana
 * @param tokenMint Địa chỉ của token mint
 * @returns Số decimal của token
 */
export const getTokenDecimals = async (
  connection: Connection,
  tokenMint: PublicKey
): Promise<number> => {
  try {
    const mintInfo = await connection.getParsedAccountInfo(tokenMint);
    if (mintInfo.value) {
      const data = mintInfo.value.data;
      // @ts-expect-error - Truy cập vào thuộc tính parsed của data
      return data.parsed.info.decimals;
    }
    throw new Error("Không thể lấy thông tin token mint");
  } catch (error) {
    console.error("Error getting token decimals:", error);
    throw error;
  }
};

/**
 * Chuyển đổi số token từ dạng hiển thị sang raw amount
 * @param amount Số lượng token dạng hiển thị (ví dụ: 1.5)
 * @param decimals Số decimal của token
 * @returns Raw amount để gửi transaction
 */
export const convertToTokenAmount = (amount: number, decimals: number): BN => {
  // Sử dụng toFixed để giữ lại đúng số chữ số thập phân
  const fixedAmount = Number(amount.toFixed(decimals));
  // Chuyển đổi sang raw amount
  const rawAmount = fixedAmount * Math.pow(10, decimals);
  // Làm tròn để tránh lỗi floating point
  const roundedAmount = Math.round(rawAmount);
  return new BN(roundedAmount);
};

/**
 * Chuyển đổi raw amount sang dạng hiển thị
 * @param amount Raw amount của token
 * @param decimals Số decimal của token
 * @returns Số lượng token dạng hiển thị
 */
export const convertToDisplayAmount = (amount: BN, decimals: number): number => {
  const rawAmount = amount.toNumber();
  // Sử dụng toFixed để format số hiển thị đúng số chữ số thập phân
  return Number((rawAmount / Math.pow(10, decimals)).toFixed(decimals));
}; 