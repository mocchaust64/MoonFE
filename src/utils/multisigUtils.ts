import {
  PublicKey,
  Keypair,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
  SYSVAR_CLOCK_PUBKEY,
  SystemProgram,
} from "@solana/web3.js";
import { getMultisigPDA } from "@/utils/credentialUtils";
import { getWalletByCredentialId } from "@/lib/firebase/webAuthnService";
import { PROGRAM_ID, connection, MoonWalletProgram } from "@/lib/solana/index";
import { BN } from "@coral-xyz/anchor";

/**
 * Tìm Program Address với seed và programId
 */
export const findProgramAddress = (
  seeds: (Buffer | Uint8Array)[],
  programId: PublicKey
): [PublicKey, number] => {
  // Thay thế findProgramAddress bằng findProgramAddressSync để tránh deprecated warning
  return PublicKey.findProgramAddressSync(seeds, programId);
};

/**
 * Phân tích threshold từ dữ liệu account
 */
function parseThresholdFromAccountData(accountInfo: any): number | undefined {
  try {
    if (accountInfo?.data) {
      // Cấu trúc data: discriminator (8 bytes) + threshold (1 byte) + ...
      // Threshold nằm ở byte thứ 8
      const threshold = accountInfo.data[8];
      console.log(`Đã phân tích được threshold=${threshold} từ dữ liệu account`);
      return threshold;
    }
  } catch (parseError) {
    console.error("Lỗi khi phân tích dữ liệu account để lấy threshold:", parseError);
  }
  return undefined;
}

/**
 * Lấy threshold từ Firebase
 */
async function getThresholdFromFirebase(credentialId: string): Promise<number | undefined> {
  try {
    const credentialMapping = await getWalletByCredentialId(credentialId);
    if (credentialMapping?.threshold !== undefined) {
      console.log(`Đã lấy được threshold=${credentialMapping.threshold} từ Firebase`);
      return credentialMapping.threshold;
    }
  } catch (firebaseError) {
    console.error("Lỗi khi lấy threshold từ Firebase:", firebaseError);
  }
  return undefined;
}

/**
 * Tìm multisig wallet với credential ID
 */
export const findMultisigWallet = async (
  credentialId: string,
  program: MoonWalletProgram | null,
  callbacks: {
    onSuccess?: (data: any) => void;
    onError?: (error: any) => void;
    onProgress?: (status: string) => void;
  } = {}
) => {
  try {
    callbacks.onProgress?.("Đang tìm multisig wallet...");

    // Tính PDA từ credential ID
    const multisigPDA = getMultisigPDA(credentialId);

    // Kiểm tra tài khoản tồn tại
    const accountInfo = await connection.getAccountInfo(multisigPDA);

    if (!accountInfo) {
      callbacks.onError?.(
        `Không tìm thấy multisig với credential ID: ${credentialId}`
      );
      return null;
    }

    // Nếu có program, lấy thông tin chi tiết
    if (program) {
      const multisigAccount = await (program.account as any).multisigWallet.fetch(multisigPDA);

      callbacks.onProgress?.(`Đã tìm thấy multisig: ${multisigPDA.toString()}`);
      callbacks.onSuccess?.({
        pubkey: multisigPDA,
        account: multisigAccount,
        address: multisigPDA.toString(),
        threshold: multisigAccount.threshold,
        guardianCount: multisigAccount.guardianCount,
      });

      return {
        pubkey: multisigPDA,
        account: multisigAccount,
        address: multisigPDA.toString(),
      };
    } 
    
    // Trường hợp không có program
    callbacks.onProgress?.(
      "Tìm thấy multisig nhưng chưa thể tải thông tin chi tiết (program chưa sẵn sàng)"
    );

    // Thử lấy threshold từ Firebase
    const thresholdFromFirebase = await getThresholdFromFirebase(credentialId);
    
    if (thresholdFromFirebase !== undefined) {
      const result = {
        pubkey: multisigPDA,
        account: null,
        address: multisigPDA.toString(),
        threshold: thresholdFromFirebase,
      };
      
      callbacks.onSuccess?.(result);
      return result;
    }

    // Nếu không có trong Firebase, thử phân tích từ dữ liệu account
    const parsedThreshold = parseThresholdFromAccountData(accountInfo);
    
    const result = {
      pubkey: multisigPDA,
      account: null,
      address: multisigPDA.toString(),
      threshold: parsedThreshold,
      guardianCount: null, // Không thể lấy được guardianCount khi không có program
    };
    
    callbacks.onSuccess?.(result);
    return result;
    
  } catch (error) {
    console.error("Lỗi khi tìm multisig:", error);
    callbacks.onError?.(
      error instanceof Error ? error.message : "Lỗi không xác định"
    );
    return null;
  }
};


/**
 * Tải danh sách đề xuất của một multisig
 */
export const loadProposals = async (
  multisigPubkey: PublicKey,
  callbacks: {
    onSuccess?: (proposals: any[]) => void;
    onError?: (error: any) => void;
    onProgress?: (status: string) => void;
  } = {}
) => {
  try {
    callbacks.onProgress?.(
      "Đang tải danh sách đề xuất trực tiếp từ blockchain..."
    );

    // Tìm tất cả accounts được tạo bởi program
    const programAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [
        // Filter theo discriminator của TransactionProposal account
        // 8 byte đầu tiên của account data là discriminator
        {
          memcmp: {
            offset: 8, // Offset đến trường multisig sau discriminator
            bytes: multisigPubkey.toBase58(),
          },
        },
      ],
    });

    callbacks.onProgress?.(
      `Đã tìm thấy ${programAccounts.length} accounts liên quan`
    );

    // Phân tích thủ công dữ liệu từ các account
    const proposals = programAccounts
      .map(({ pubkey, account }) => {
        try {
          // Bỏ qua 8 byte discriminator + 32 byte multisig pubkey
          const dataBuffer = account.data;
          const offset = 8 + 32; // bỏ qua discriminator và multisig pubkey

          // Đọc proposalId (u64)
          const proposalId = new BN(dataBuffer.subarray(offset, offset + 8), "le");

          // Đọc description (string)
          let currentOffset = offset + 8;
          const descriptionLength = dataBuffer.readUInt32LE(currentOffset);
          currentOffset += 4;
          const description = dataBuffer
            .subarray(currentOffset, currentOffset + descriptionLength)
            .toString();
          currentOffset += descriptionLength;

          // Đọc action (string)
          const actionLength = dataBuffer.readUInt32LE(currentOffset);
          currentOffset += 4;
          const action = dataBuffer
            .subarray(currentOffset, currentOffset + actionLength)
            .toString();
          currentOffset += actionLength;

          // Đọc status (u8)
          const status = dataBuffer[currentOffset];
          currentOffset += 1;

          // Đọc signaturesCount (u8)
          const signaturesCount = dataBuffer[currentOffset];
          currentOffset += 1;

          // Đọc requiredSignatures (u8)
          const requiredSignatures = dataBuffer[currentOffset];
          currentOffset += 1;

          // Đọc createdAt (i64)
          const createdAt = new BN(
            dataBuffer.subarray(currentOffset, currentOffset + 8),
            "le"
          );
          currentOffset += 8;

          // Đọc proposer (PublicKey)
          const proposerBytes = dataBuffer.subarray(
            currentOffset,
            currentOffset + 32
          );

          // ... phần tiếp theo để phân tích dữ liệu chi tiết

          return {
            pubkey,
            proposalId: proposalId.toNumber(),
            description,
            action,
            status,
            signaturesCount,
            requiredSignatures,
            createdAt: createdAt.toNumber(),
            proposer: new PublicKey(proposerBytes),
            // ... các trường khác
          };
        } catch (error) {
          console.error(
            `Lỗi khi phân tích đề xuất ${pubkey.toString()}:`,
            error
          );
          return null;
        }
      })
      .filter(Boolean); // Lọc bỏ các phần tử null

    callbacks.onSuccess?.(proposals);
    return proposals;
  } catch (error) {
    console.error("Lỗi khi tải danh sách đề xuất:", error);
    callbacks.onError?.(
      error instanceof Error ? error.message : "Lỗi không xác định"
    );
    return [];
  }
};

/**
 * Tạo đề xuất giao dịch mới
 */
export const createProposal = async (
  multisigAddress: PublicKey,
  payerKeypair: Keypair,
  params: {
    description: string;
    destinationAddress: string;
    amount: string;
    guardianId?: number; // Để cấu hình guardianId, mặc định là 1 (owner)
  },
  callbacks: {
    onSuccess?: (signature: string) => void;
    onError?: (error: any) => void;
    onProgress?: (status: string) => void;
  } = {},
  existingTransaction?: Transaction // Tham số mới cho transaction có sẵn
) => {
  try {
    callbacks.onProgress?.("Đang tạo đề xuất giao dịch...");

    const multisigPubkey = new PublicKey(multisigAddress);

    // Mặc định guardian ID là 1 (owner)
    const guardianId = new BN(params.guardianId ?? 1);

    // Tính PDA cho guardian
    const [guardianPubkey] = findProgramAddress(
      [
        Buffer.from("guardian"),
        multisigPubkey.toBuffer(),
        guardianId.toArrayLike(Buffer, "le", 8),
      ],
      PROGRAM_ID
    );

    // Tạo proposal ID dựa trên timestamp
    const proposalId = new BN(Date.now());

    // Tính toán địa chỉ PDA cho proposal
    const [proposalPubkey] = findProgramAddress(
      [
        Buffer.from("proposal"),
        multisigPubkey.toBuffer(),
        proposalId.toArrayLike(Buffer, "le", 8),
      ],
      PROGRAM_ID
    );

    // Tạo tham số cho đề xuất
    const destinationPubkey = new PublicKey(params.destinationAddress);
    const amountLamports = new BN(parseFloat(params.amount) * LAMPORTS_PER_SOL);

    callbacks.onProgress?.("Đang chuẩn bị giao dịch...");

    // Sử dụng transaction có sẵn hoặc tạo mới
    const tx = existingTransaction || new Transaction();

    // Discriminator cho createProposal
    const createProposalDiscriminator = new Uint8Array([
      132, 116, 68, 174, 216, 160, 198, 22,
    ]);

    // Tạo dữ liệu instruction
    const descriptionBuffer = Buffer.from(params.description);
    const descriptionLenBuffer = Buffer.alloc(4);
    descriptionLenBuffer.writeUInt32LE(descriptionBuffer.length, 0);

    const actionBuffer = Buffer.from("transfer");
    const actionLenBuffer = Buffer.alloc(4);
    actionLenBuffer.writeUInt32LE(actionBuffer.length, 0);

    // Tạo data instruction
    const data = Buffer.concat([
      Buffer.from(createProposalDiscriminator),
      Buffer.from(proposalId.toArrayLike(Buffer, "le", 8)),
      Buffer.from(descriptionLenBuffer),
      descriptionBuffer,
      Buffer.from(guardianId.toArrayLike(Buffer, "le", 8)),
      Buffer.from(actionLenBuffer),
      actionBuffer,
      // ActionParams với định dạng đúng
      // 1. amount (option<u64>): Some variant (1) + u64 value
      Buffer.from([1]), // Some variant cho amount
      Buffer.from(amountLamports.toArrayLike(Buffer, "le", 8)),
      // 2. destination (option<publicKey>): Some variant (1) + public key (32 bytes)
      Buffer.from([1]), // Some variant cho destination
      destinationPubkey.toBuffer(),
      // 3. tokenMint (option<publicKey>): None variant (0)
      Buffer.from([0]), // None variant cho tokenMint
    ]);

    // Thêm instruction vào transaction
    tx.add(
      new TransactionInstruction({
        keys: [
          { pubkey: multisigPubkey, isSigner: false, isWritable: true },
          { pubkey: proposalPubkey, isSigner: false, isWritable: true },
          { pubkey: guardianPubkey, isSigner: false, isWritable: false },
          { pubkey: payerKeypair.publicKey, isSigner: true, isWritable: true },
          { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: PROGRAM_ID,
        data,
      })
    );

    // Gửi transaction
    tx.feePayer = payerKeypair.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    tx.sign(payerKeypair);

    callbacks.onProgress?.("Đang gửi giao dịch...");
    const signature = await connection.sendRawTransaction(tx.serialize());
    
    // Thay thế cách gọi deprecated
    const latestBlockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      signature
    });

    callbacks.onProgress?.(`Đã tạo đề xuất thành công: ${signature}`);
    callbacks.onSuccess?.(signature);

    return signature;
  } catch (error) {
    console.error("Lỗi khi tạo đề xuất:", error);
    callbacks.onError?.(
      error instanceof Error ? error.message : "Lỗi không xác định"
    );
    return null;
  }
};





