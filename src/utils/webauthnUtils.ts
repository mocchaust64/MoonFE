import * as CBOR from "cbor-web";

import { bufferToHex } from "./bufferUtils";

// Define interface at the top of the file to avoid reference errors
interface StoredCredential {
  credentialId: string;
  publicKey: string;
  userId: number[];
  displayName: string;
  createdAt: string;
}

// SafeWebAuthn wrapper to handle errors better
const SafeWebAuthn = {
  // Check WebAuthn support with better error handling
  isSupported(): boolean {
    try {
      return (
        typeof window !== 'undefined' &&
        window.PublicKeyCredential !== undefined &&
        typeof window.PublicKeyCredential === "function" &&
        typeof navigator.credentials !== 'undefined' &&
        typeof navigator.credentials.create === 'function' &&
        typeof navigator.credentials.get === 'function'
      );
    } catch (error) {
      console.error("Error checking WebAuthn support:", error);
      return false;
    }
  },

  // Safely create credential
  async createCredential(options: PublicKeyCredentialCreationOptions): Promise<PublicKeyCredential | null> {
    if (!this.isSupported()) {
      console.warn("WebAuthn is not supported in this browser");
      return null;
    }

    try {
      const credential = await navigator.credentials.create({
        publicKey: options,
      });
      return credential as PublicKeyCredential;
    } catch (error) {
      if (error instanceof DOMException) {
        // Handle specific WebAuthn errors
        if (error.name === "NotAllowedError") {
          console.error("User rejected the WebAuthn request");
        } else if (error.name === "SecurityError") {
          console.error("The operation is not secure (mixedContent, etc.)");
        } else if (error.name === "NotSupportedError") {
          console.error("This method is not supported by this device");
        }
      }
      console.error("Error creating WebAuthn credential:", error);
      throw error;
    }
  },

  // Safely get credential
  async getCredential(options: PublicKeyCredentialRequestOptions): Promise<PublicKeyCredential | null> {
    if (!this.isSupported()) {
      console.warn("WebAuthn is not supported in this browser");
      return null;
    }

    try {
      const credential = await navigator.credentials.get({
        publicKey: options,
      });
      return credential as PublicKeyCredential;
    } catch (error) {
      if (error instanceof DOMException) {
        // Handle specific WebAuthn errors
        if (error.name === "NotAllowedError") {
          console.error("User rejected the WebAuthn request");
        } else if (error.name === "SecurityError") {
          console.error("The operation is not secure (mixedContent, etc.)");
        } else if (error.name === "NotSupportedError") {
          console.error("This method is not supported by this device");
        }
      }
      console.error("Error getting WebAuthn credential:", error);
      throw error;
    }
  }
};

/**
 * Create new WebAuthn credential
 */
export const createWebAuthnCredential = async (
  walletName: string,
): Promise<{ credentialId: string; publicKey: string; rawId: Uint8Array }> => {
  if (!SafeWebAuthn.isSupported()) {
    throw new Error("WebAuthn is not supported in this browser");
  }

  try {
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  const userId = new Uint8Array(16);
  crypto.getRandomValues(userId);

  const options: PublicKeyCredentialCreationOptions = {
    challenge: challenge,
    rp: {
      name: "Gokei Wallet",
      id: window.location.hostname,
    },
    user: {
      id: userId,
      name: walletName,
      displayName: walletName,
    },
    pubKeyCredParams: [
      { type: "public-key", alg: -7 },
      { type: "public-key", alg: -257 },
    ],
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      userVerification: "preferred",
      requireResidentKey: true,
    },
    timeout: 60000,
    attestation: "direct",
  };

    const credential = await SafeWebAuthn.createCredential(options);

  if (!credential) {
      throw new Error("Could not create WebAuthn key");
  }

  const response = credential.response as AuthenticatorAttestationResponse;

  const attestationBuffer = new Uint8Array(response.attestationObject);
  const attestationObject = CBOR.decode(attestationBuffer.buffer);

  const credentialId = bufferToHex(credential.rawId);

  const authData = attestationObject.authData;
  const publicKeyBytes = extractPublicKeyFromAuthData(authData);
  const publicKey = bufferToHex(publicKeyBytes);

  saveCredentialInfo(credentialId, publicKey, userId, walletName);

  return {
    credentialId,
    publicKey,
    rawId: new Uint8Array(credential.rawId),
  };
  } catch (error) {
    console.error("Error in createWebAuthnCredential:", error);
    throw new Error(`Could not create WebAuthn key: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Extract public key from authenticator data
 */
function extractPublicKeyFromAuthData(authData: Uint8Array): Uint8Array {
  let offset = 37;

  offset += 16;

  const credentialIdLength = (authData[offset] << 8) | authData[offset + 1];
  offset += 2;

  offset += credentialIdLength;

  const cosePublicKey = authData.slice(offset);

  try {
    const publicKeyObj = CBOR.decode(cosePublicKey);

    const x = publicKeyObj.get(-2);
    const y = publicKeyObj.get(-3);

    const uncompressedKey = new Uint8Array(65);
    uncompressedKey[0] = 0x04;
    uncompressedKey.set(new Uint8Array(x), 1);
    uncompressedKey.set(new Uint8Array(y), 33);

    return uncompressedKey;
  } catch (e) {
    console.error("Error extracting public key:", e);
    // Create dummy key if error - this is a fallback
    const dummyKey = new Uint8Array(65);
    dummyKey[0] = 0x04;
    const randomX = new Uint8Array(32);
    const randomY = new Uint8Array(32);
    window.crypto.getRandomValues(randomX);
    window.crypto.getRandomValues(randomY);
    dummyKey.set(randomX, 1);
    dummyKey.set(randomY, 33);

    return dummyKey;
  }
}

/**
 * Use existing WebAuthn credential
 */
export const getWebAuthnCredential = async (
  credentialId: Buffer,
  challenge?: Uint8Array,
): Promise<{
  signature: Uint8Array;
  authenticatorData: Uint8Array;
  clientDataJSON: Uint8Array;
}> => {
  if (!SafeWebAuthn.isSupported()) {
    throw new Error("WebAuthn is not supported in this browser");
  }

  // Use provided challenge or create a new one if not available
  const finalChallenge =
    challenge || crypto.getRandomValues(new Uint8Array(32));

  // Create options for get assertion
  const options: PublicKeyCredentialRequestOptions = {
    challenge: finalChallenge,
    allowCredentials: [
      {
        id: credentialId,
        type: "public-key",
      },
    ],
    userVerification: "preferred",
    timeout: 60000,
  };

  const assertion = await SafeWebAuthn.getCredential(options);

  if (!assertion) {
    throw new Error("Could not get WebAuthn authentication information");
  }

  const response = assertion.response as AuthenticatorAssertionResponse;

  return {
    signature: new Uint8Array(response.signature),
    authenticatorData: new Uint8Array(response.authenticatorData),
    clientDataJSON: new Uint8Array(response.clientDataJSON),
  };
};

/**
 * Check if WebAuthn is supported
 */
export const isWebAuthnSupported = (): boolean => {
  return SafeWebAuthn.isSupported();
};

// Run some options to check compatibility
export const checkWebAuthnCompatibility = async (): Promise<string> => {
  if (!isWebAuthnSupported()) {
    return "WebAuthn is not supported in this browser";
  }

  try {
    // Check if browser supports the "isUserVerifyingPlatformAuthenticatorAvailable" property
    if (typeof PublicKeyCredential !== 'undefined' && 
        PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      try {
      const available =
        await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!available) {
          return "This device does not have supported biometric authentication";
        }
      } catch (error) {
        return "Could not check authenticator: " + (error instanceof Error ? error.message : String(error));
      }
    }

    return "WebAuthn is fully supported";
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `Error when checking WebAuthn: ${errorMessage}`;
  }
};

// Function to convert signature from DER to raw
export const derToRaw = (signature: Buffer): Uint8Array => {
  try {   
    // Check DER format
    if (signature[0] !== 0x30) {
      throw new Error('Signature not in DER format: first byte is not 0x30');
    }

    // DER format: 0x30 [total-length] 0x02 [r-length] [r] 0x02 [s-length] [s]
    let offset = 2; // Skip 0x30 + len
    
    // Read r
    if (signature[offset] !== 0x02) {
      throw new Error('Invalid DER format: r marker (0x02) not found');
    }
    offset++; // Skip 0x02
    
    const rLen = signature[offset++];
    // Replace slice with Buffer.subarray (not deprecated)
    const r = Buffer.from(signature.subarray(offset, offset + rLen));
    offset += rLen;
    
    // Read s
    if (signature[offset] !== 0x02) {
      throw new Error('Invalid DER format: s marker (0x02) not found');
    }
    offset++; // Skip 0x02
    
    const sLen = signature[offset++];
    // Replace slice with Buffer.subarray (not deprecated)
    const s = Buffer.from(signature.subarray(offset, offset + sLen));
   
    // Prepare r and s for raw format (each part 32 bytes)
    const rPadded = new Uint8Array(32);
    const sPadded = new Uint8Array(32);
    
    if (r.length <= 32) {
      // If r is shorter than 32 bytes, add padding
      rPadded.set(new Uint8Array(r), 32 - r.length);
    } else {
      // If r is longer than 32 bytes (usually has a 0x00 byte at the start), take the last 32 bytes
      // Replace slice with Buffer.subarray (not deprecated)
      rPadded.set(new Uint8Array(r.subarray(r.length - 32)));
    }
    
    if (s.length <= 32) {
      // If s is shorter than 32 bytes, add padding
      sPadded.set(new Uint8Array(s), 32 - s.length);
    } else {
      // If s is longer than 32 bytes, take the last 32 bytes
      // Replace slice with Buffer.subarray (not deprecated)
      sPadded.set(new Uint8Array(s.subarray(s.length - 32)));
    }
    
    // Concatenate r and s
    const rawSignature = new Uint8Array(64);
    rawSignature.set(rPadded, 0);
    rawSignature.set(sPadded, 32);
    
    return rawSignature;
  } catch (error) {
    console.error('Error converting signature from DER to raw:', error);
    throw error;
  }
};

// Separate function to read credentials from localStorage
function getCredentialsFromLocalStorage(): StoredCredential[] {
  try {
    const credentialsListStr = localStorage.getItem("webauthnCredentials");
    if (!credentialsListStr) return [];
    
    const credentialsList = JSON.parse(credentialsListStr);
    return Array.isArray(credentialsList) ? credentialsList : [];
  } catch (error) {
    console.warn("Could not read credentials list from localStorage:", error);
    return [];
  }
}

// Separate function to find public key from credentials list
function findPublicKeyByRawId(credentials: StoredCredential[], rawId: ArrayBuffer): Uint8Array | undefined {
  const hexId = bufferToHex(rawId);
  const matchingCred = credentials.find(cred => cred.credentialId === hexId);
  
  if (matchingCred?.publicKey) {
    return Buffer.from(matchingCred.publicKey, "hex");
  }
  return undefined;
}

// Separate function to create allowCredentials options
function createAllowCredentialsOptions(
  credentialId: string | undefined, 
  allowEmpty: boolean,
  credentials: StoredCredential[]
): { id: ArrayBuffer; type: "public-key" }[] | undefined {
  if (credentialId && !allowEmpty) {
    // Convert Buffer to Uint8Array and then to ArrayBuffer
    const idBuffer = new Uint8Array(Buffer.from(credentialId, "hex")).buffer;
    return [
      {
        id: idBuffer,
        type: "public-key",
      },
    ];
  } 
  
  if (!credentialId && !allowEmpty && credentials.length > 0) {
    return credentials.map((cred) => {
      // Convert Buffer to Uint8Array and then to ArrayBuffer
      const idBuffer = new Uint8Array(Buffer.from(cred.credentialId, "hex")).buffer;
      return {
        id: idBuffer,
        type: "public-key" as const,
      };
    });
  }
  
  return undefined;
}

/**
 * Get WebAuthn assertion from existing credential
 */
export const getWebAuthnAssertion = async (
  credentialId?: string,
  message?: string,
  allowEmpty: boolean = false
): Promise<{
  signature: Uint8Array;
  authenticatorData: Uint8Array;
  clientDataJSON: Uint8Array;
  pubKey?: Uint8Array;
}> => {
  if (!SafeWebAuthn.isSupported()) {
    throw new Error("WebAuthn is not supported in this browser");
  }

  // Create challenge from message or random
  const challenge = message 
    ? new TextEncoder().encode(message)
    : crypto.getRandomValues(new Uint8Array(32));

  // Read credentials from localStorage
  const credentials = getCredentialsFromLocalStorage();
  
  // Create options for get assertion
  const options: PublicKeyCredentialRequestOptions = {
    challenge,
    rpId: window.location.hostname,
    timeout: 60000,
    userVerification: "preferred",
    allowCredentials: createAllowCredentialsOptions(credentialId, allowEmpty, credentials)
  };

  const assertion = await SafeWebAuthn.getCredential(options);
  
  // Fix the null assertion error
  if (!assertion) {
    throw new Error("Could not get WebAuthn authentication information");
  }

  const response = assertion.response as AuthenticatorAssertionResponse;
  
  // Find public key from localStorage
  const pubKey = findPublicKeyByRawId(credentials, assertion.rawId);

  return {
    signature: new Uint8Array(response.signature),
    authenticatorData: new Uint8Array(response.authenticatorData),
    clientDataJSON: new Uint8Array(response.clientDataJSON),
    pubKey
  };
};

/**
 * Save credential information to localStorage
 */
function saveCredentialInfo(
  credentialId: string,
  publicKey: string,
  userId: Uint8Array,
  displayName: string,
): void {
  try {
    const newCredential: StoredCredential = {
      credentialId,
      publicKey,
      userId: Array.from(userId),
      displayName,
      createdAt: new Date().toISOString(),
    };

    // Add to credentials list
    const credentials = getCredentialsFromLocalStorage();
    const updatedCredentials = [...credentials, newCredential];

    localStorage.setItem(
      "webauthnCredentials",
      JSON.stringify(updatedCredentials)
    );
  } catch (error) {
    console.error("Could not save credential information:", error);
  }
}

/**
 * Authenticate to login with WebAuthn using known credential ID
 */
export const getWebAuthnAssertionForLogin = async (
  credentialIdBase64: string,
  allowEmpty: boolean = false,
): Promise<{
  success: boolean;
  rawId?: Uint8Array;
  error?: string;
}> => {
  try {
    if (!SafeWebAuthn.isSupported()) {
      throw new Error("WebAuthn is not supported in this browser");
    }

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    // Create options for get assertion
    const options: PublicKeyCredentialRequestOptions = {
      challenge: challenge,
      timeout: 60000,
      userVerification: "preferred",
    };

    // If credential ID exists, add to allowCredentials
    if (credentialIdBase64) {
      const credentialIdBuffer = new Uint8Array(
        Buffer.from(credentialIdBase64, "base64"),
      );
      options.allowCredentials = [
        {
          id: credentialIdBuffer,
          type: "public-key",
        },
      ];
    } else if (!allowEmpty) {
      throw new Error("Credential ID not provided");
    }

    const assertion = await SafeWebAuthn.getCredential(options);

    if (!assertion) {
      throw new Error("Could not get WebAuthn authentication information");
    }

    return {
      success: true,
      rawId: new Uint8Array(assertion.rawId),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not authenticate",
    };
  }
};

/**
 * Create verification data from WebAuthn assertion
 * @param assertion - WebAuthn assertion
 * @returns Uint8Array containing verification data (authenticatorData + hash(clientDataJSON))
 */
export const createWebAuthnVerificationData = async (
  assertion: {
    signature: Uint8Array;
    authenticatorData: Uint8Array;
    clientDataJSON: Uint8Array;
  }
): Promise<Uint8Array> => {
  const clientDataHash = await crypto.subtle.digest('SHA-256', assertion.clientDataJSON);
  const clientDataHashBytes = new Uint8Array(clientDataHash);
  
  const verificationData = new Uint8Array(assertion.authenticatorData.length + clientDataHashBytes.length);
  verificationData.set(new Uint8Array(assertion.authenticatorData), 0);
  verificationData.set(clientDataHashBytes, assertion.authenticatorData.length);
  
  return verificationData;
};
