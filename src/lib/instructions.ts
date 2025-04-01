import { bigIntToLeBytes } from "@/utils/helpers";

export interface AddGuardianInstructionData {
  guardianId: number;
  guardianName: string;
  recoveryHash: Uint8Array;
  isOwner: boolean;
  webauthnPubkey: Uint8Array;
}

export const createAddGuardianInstructionData = ({
  guardianId,
  guardianName,
  recoveryHash,
  isOwner,
  webauthnPubkey,
}: AddGuardianInstructionData): Uint8Array => {
  // Discriminator cho add_guardian
  const addGuardianDiscriminator = new Uint8Array([
    167, 189, 170, 27, 74, 240, 201, 241,
  ]);

  // Convert guardianId to bytes
  const guardianIdBytes = bigIntToLeBytes(BigInt(guardianId));

  // Convert name to bytes
  const nameBuffer = Buffer.from(guardianName);
  const nameLenBuffer = Buffer.alloc(4);
  nameLenBuffer.writeUInt32LE(nameBuffer.length, 0);

  // Combine all data
  return Buffer.concat([
    addGuardianDiscriminator,
    guardianIdBytes,
    nameLenBuffer,
    nameBuffer,
    recoveryHash,
    Buffer.from([isOwner ? 1 : 0]),
    Buffer.from([1]), // Some variant for webauthn
    webauthnPubkey,
  ]);
};
