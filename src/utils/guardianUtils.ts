import { PublicKey } from "@solana/web3.js";

import { PROGRAM_ID } from "@/lib/solana/connection";
import { connection } from "@/lib/solana/connection";
import { bigIntToLeBytes } from "@/utils/helpers";

// Định nghĩa interface cho đối tượng Guardian
export interface Guardian {
  id: number;
  address: string;
  name: string;
  isOwner: boolean;
  isActive: boolean;
  recoveryHash: string;
  webauthnPubkey?: string;
  bump?: number;
}

/**
 * Hàm lấy danh sách guardians từ blockchain
 * @param multisigAddress Địa chỉ multisig
 * @param maxGuardians Số lượng guardian tối đa cần kiểm tra
 * @returns Danh sách các guardian đã tìm thấy
 */
export async function getGuardiansFromBlockchain(
  multisigAddress: PublicKey | string,
  maxGuardians: number = 8,
): Promise<Guardian[]> {
  const guardians: Guardian[] = [];

  if (!multisigAddress) {
    console.error("Missing multisig address");
    return guardians;
  }

  // Chuyển đổi multisigAddress thành PublicKey nếu nó là chuỗi
  const multisigPubkey =
    typeof multisigAddress === "string"
      ? new PublicKey(multisigAddress)
      : multisigAddress;

  console.log(`Fetching guardians for multisig: ${multisigPubkey.toString()}`);

  // Kiểm tra guardian từ ID 1 đến maxGuardians
  for (let i = 1; i <= maxGuardians; i++) {
    try {
      // Tính PDA cho guardian với ID i
      const guardianIdBigInt = BigInt(i);
      const guardianIdBytes = bigIntToLeBytes(guardianIdBigInt);

      const [guardianPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("guardian"), multisigPubkey.toBuffer(), guardianIdBytes],
        PROGRAM_ID,
      );

      console.log(
        `Checking guardian ID ${i} at address: ${guardianPDA.toString()}`,
      );

      // Kiểm tra xem guardian có tồn tại không
      const guardianAccount = await connection.getAccountInfo(guardianPDA);

      if (guardianAccount) {
        console.log(
          `Found guardian ID ${i} - data size: ${guardianAccount.data.length} bytes`,
        );

        // Kiểm tra xem account có thuộc về program của chúng ta không
        if (!guardianAccount.owner.equals(PROGRAM_ID)) {
          console.error(
            `Account doesn't belong to our program. Owner: ${guardianAccount.owner.toString()}`,
          );
          continue;
        }

        // Parse dữ liệu guardian
        try {
          const guardian = parseGuardianData(
            guardianAccount.data,
            i,
            guardianPDA,
          );
          guardians.push(guardian);
          console.log(`Successfully parsed guardian: ${guardian.name}`);
        } catch (parseError) {
          console.error(`Error parsing guardian data for ID ${i}:`, parseError);
        }
      } else {
        console.log(
          `Guardian ID ${i}: Account doesn't exist at ${guardianPDA.toString()}`,
        );
      }
    } catch (error) {
      console.error(`Error checking guardian ID ${i}:`, error);
    }
  }

  console.log(`Found ${guardians.length} guardians in total`);
  return guardians;
}

/**
 * Hàm phân tích dữ liệu của guardian từ dữ liệu account
 * @param data Dữ liệu account
 * @param id ID của guardian
 * @param guardianPDA Địa chỉ PDA của guardian
 * @returns Đối tượng Guardian đã được phân tích
 */
function parseGuardianData(
  data: Buffer,
  id: number,
  guardianPDA: PublicKey,
): Guardian {
  // Bỏ qua 8 byte discriminator
  const guardianData = data.slice(8);
  console.log(
    `Data after skipping discriminator: ${guardianData.length} bytes`,
  );

  try {
    // Parse dữ liệu theo cấu trúc của Guardian account từ IDL

    // Đọc wallet address (32 bytes)
    const walletBytes = guardianData.slice(0, 32);
    const wallet = new PublicKey(walletBytes);
    console.log(`Wallet address parsed: ${wallet.toString()}`);

    // Đọc guardian_id (8 bytes - u64)
    const guardianIdBytes = guardianData.slice(32, 40);
    let guardianId = BigInt(0);
    for (let i = 0; i < 8; i++) {
      guardianId |= BigInt(guardianIdBytes[i]) << BigInt(8 * i);
    }
    console.log(`Guardian ID parsed: ${guardianId}`);

    // Đọc name (string dài tối đa 32 bytes)
    const nameLength = new DataView(
      guardianData.buffer,
      guardianData.byteOffset + 40,
      4,
    ).getUint32(0, true);
    console.log(`Guardian name length: ${nameLength}`);

    if (nameLength > 100) {
      throw new Error("Invalid name length");
    }

    // Vị trí bắt đầu của name bytes
    const nameOffset = 44;
    const nameBytes = guardianData.slice(nameOffset, nameOffset + nameLength);
    const name = new TextDecoder().decode(nameBytes);
    console.log(`Guardian name parsed: ${name}`);

    // Vị trí tiếp theo sau name
    let currentOffset = nameOffset + nameLength;

    // Đọc is_active (1 byte)
    const isActive = guardianData[currentOffset] === 1;
    console.log(`Is active: ${isActive}`);
    currentOffset += 1;

    // Đọc recovery_hash (32 bytes)
    const recoveryHash = guardianData.slice(currentOffset, currentOffset + 32);
    const recoveryHashHex = Buffer.from(recoveryHash).toString("hex");
    currentOffset += 32;

    // Đọc is_owner (1 byte)
    const isOwner = guardianData[currentOffset] === 1;
    console.log(`Is owner: ${isOwner}`);
    currentOffset += 1;

    // Đọc webauthn_pubkey (option<[u8; 33]>)
    let webauthnPubkey: string | undefined;
    const hasWebauthn = guardianData[currentOffset] === 1;
    currentOffset += 1;

    if (hasWebauthn) {
      const webauthnKey = guardianData.slice(currentOffset, currentOffset + 33);
      webauthnPubkey = Buffer.from(webauthnKey).toString("hex");
      currentOffset += 33;
    }

    // Đọc bump (1 byte)
    const bump = guardianData[currentOffset];

    return {
      id,
      address: guardianPDA.toString(),
      name,
      isOwner,
      isActive,
      recoveryHash: recoveryHashHex,
      webauthnPubkey,
      bump,
    };
  } catch (error) {
    console.error("Error parsing guardian data:", error);
    throw error;
  }
}

/**
 * Hàm lấy thông tin chi tiết về một guardian
 * @param multisigAddress Địa chỉ multisig
 * @param guardianId ID của guardian cần lấy thông tin
 * @returns Thông tin chi tiết của guardian hoặc null nếu không tìm thấy
 */
export async function getGuardianInfo(
  multisigAddress: PublicKey | string,
  guardianId: number,
): Promise<Guardian | null> {
  if (!multisigAddress) {
    console.error("Missing multisig address");
    return null;
  }

  // Chuyển đổi multisigAddress thành PublicKey nếu nó là chuỗi
  const multisigPubkey =
    typeof multisigAddress === "string"
      ? new PublicKey(multisigAddress)
      : multisigAddress;

  try {
    // Tính PDA cho guardian với ID được chọn
    const guardianIdBigInt = BigInt(guardianId);
    const guardianIdBytes = bigIntToLeBytes(guardianIdBigInt);

    const [guardianPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("guardian"), multisigPubkey.toBuffer(), guardianIdBytes],
      PROGRAM_ID,
    );

    console.log(
      `Querying guardian ID=${guardianId} with PDA: ${guardianPDA.toString()}`,
    );

    // Kiểm tra xem guardian có tồn tại không
    const guardianAccount = await connection.getAccountInfo(guardianPDA);

    if (!guardianAccount) {
      console.log(
        `Guardian account not found at address: ${guardianPDA.toString()}`,
      );
      return null;
    }

    // Kiểm tra xem account có thuộc về program của chúng ta không
    if (!guardianAccount.owner.equals(PROGRAM_ID)) {
      console.error(
        `Account doesn't belong to our program. Owner: ${guardianAccount.owner.toString()}`,
      );
      return null;
    }

    // Parse dữ liệu guardian
    return parseGuardianData(guardianAccount.data, guardianId, guardianPDA);
  } catch (error) {
    console.error(`Error querying guardian info for ID ${guardianId}:`, error);
    return null;
  }
}

export const hashRecoveryPhrase = async (
  phrase: string,
): Promise<Uint8Array> => {
  const phraseBytes = new TextEncoder().encode(phrase);
  const inputBytes = new Uint8Array(32);
  inputBytes.set(phraseBytes.slice(0, Math.min(phraseBytes.length, 32)));
  const hashBuffer = await crypto.subtle.digest("SHA-256", inputBytes);
  return new Uint8Array(hashBuffer);
};

export const hashCredentialId = async (
  credentialId: string,
): Promise<Uint8Array> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(credentialId);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hashBuffer);
};
