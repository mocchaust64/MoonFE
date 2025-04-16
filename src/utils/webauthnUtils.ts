import * as CBOR from "cbor-web";

import { bufferToHex } from "./bufferUtils";

/**
 * Tạo WebAuthn credential mới
 */
export const createWebAuthnCredential = async (
  walletName: string,
): Promise<{ credentialId: string; publicKey: string; rawId: Uint8Array }> => {
  try {
    if (!isWebAuthnSupported()) {
      throw new Error("WebAuthn không được hỗ trợ trên trình duyệt này");
    }

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const userId = new Uint8Array(16);
    crypto.getRandomValues(userId);

    const options: PublicKeyCredentialCreationOptions = {
      challenge: challenge,
      rp: {
        name: "Moon Wallet",
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

    const credential = (await navigator.credentials.create({
      publicKey: options,
    })) as PublicKeyCredential;

    if (!credential) {
      throw new Error("Không thể tạo khóa WebAuthn");
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
    throw error;
  }
};

/**
 * Trích xuất public key từ authenticator data
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
 * Sử dụng WebAuthn credential đã có
 */
export const getWebAuthnCredential = async (
  credentialId: Buffer,
  challenge?: Uint8Array,
): Promise<{
  signature: Uint8Array;
  authenticatorData: Uint8Array;
  clientDataJSON: Uint8Array;
}> => {
  if (!isWebAuthnSupported()) {
    throw new Error("WebAuthn không được hỗ trợ trên trình duyệt này");
  }

  // Sử dụng challenge được cung cấp hoặc tạo mới nếu không có
  const finalChallenge =
    challenge || crypto.getRandomValues(new Uint8Array(32));

  // Tạo options cho get assertion
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

  try {
    const assertion = (await navigator.credentials.get({
      publicKey: options,
    })) as PublicKeyCredential;

    const response = assertion.response as AuthenticatorAssertionResponse;

    return {
      signature: new Uint8Array(response.signature),
      authenticatorData: new Uint8Array(response.authenticatorData),
      clientDataJSON: new Uint8Array(response.clientDataJSON),
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Kiểm tra xem WebAuthn có được hỗ trợ không
 */
export const isWebAuthnSupported = (): boolean => {
  return (
    window.PublicKeyCredential !== undefined &&
    typeof window.PublicKeyCredential === "function"
  );
};

// Chạy thử một số tùy chọn để kiểm tra khả năng tương thích
export const checkWebAuthnCompatibility = async (): Promise<string> => {
  if (!isWebAuthnSupported()) {
    return "WebAuthn không được hỗ trợ trên trình duyệt này";
  }

  try {
    // Kiểm tra xem trình duyệt có hỗ trợ thuộc tính "isUserVerifyingPlatformAuthenticatorAvailable"
    if (PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      const available =
        await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!available) {
        return "Thiết bị này không có xác thực sinh trắc học được hỗ trợ";
      }
    }

    return "WebAuthn được hỗ trợ đầy đủ";
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `Lỗi khi kiểm tra WebAuthn: ${errorMessage}`;
  }
};

// Hàm chuyển đổi chữ ký từ DER sang raw
export const derToRaw = (signature: Buffer): Uint8Array => {
  try {   
    // Kiểm tra format DER
    if (signature[0] !== 0x30) {
      throw new Error('Chữ ký không đúng định dạng DER: byte đầu tiên không phải 0x30');
    }

    // DER format: 0x30 [total-length] 0x02 [r-length] [r] 0x02 [s-length] [s]
    let offset = 2; // Skip 0x30 + len
    
    // Đọc r
    if (signature[offset] !== 0x02) {
      throw new Error('Định dạng DER không hợp lệ: không tìm thấy marker r (0x02)');
    }
    offset++; // Skip 0x02
    
    const rLen = signature[offset++];
    let r = signature.slice(offset, offset + rLen);
    offset += rLen;
    
    // Đọc s
    if (signature[offset] !== 0x02) {
      throw new Error('Định dạng DER không hợp lệ: không tìm thấy marker s (0x02)');
    }
    offset++; // Skip 0x02
    
    const sLen = signature[offset++];
    let s = signature.slice(offset, offset + sLen);
   
    // Chuẩn bị r và s cho định dạng raw (mỗi phần 32 bytes)
    const rPadded = new Uint8Array(32);
    const sPadded = new Uint8Array(32);
    
    if (r.length <= 32) {
      // Trường hợp r ngắn hơn 32 bytes, thêm padding
      rPadded.set(new Uint8Array(r), 32 - r.length);
    } else {
      // Trường hợp r dài hơn 32 bytes (thường là có byte 0x00 ở đầu), lấy 32 bytes cuối
      rPadded.set(new Uint8Array(r.slice(r.length - 32)));
    }
    
    if (s.length <= 32) {
      // Trường hợp s ngắn hơn 32 bytes, thêm padding
      sPadded.set(new Uint8Array(s), 32 - s.length);
    } else {
      // Trường hợp s dài hơn 32 bytes, lấy 32 bytes cuối
      sPadded.set(new Uint8Array(s.slice(s.length - 32)));
    }
    
    // Nối r và s lại
    const rawSignature = new Uint8Array(64);
    rawSignature.set(rPadded, 0);
    rawSignature.set(sPadded, 32);
    
    return rawSignature;
  } catch (error) {
    throw error;
  }
};

/**
 * Lấy WebAuthn assertion từ credential đã có
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
  if (!isWebAuthnSupported()) {
    throw new Error("WebAuthn không được hỗ trợ trên trình duyệt này");
  }

  // Tạo challenge từ message hoặc ngẫu nhiên nếu không có message
  let challenge: Uint8Array;
  if (message) {
    // QUAN TRỌNG: KHÔNG hash message ở đây
    // WebAuthn sẽ tự động hash message với SHA-256
    // Gửi message gốc trực tiếp làm challenge
    challenge = new TextEncoder().encode(message);
  } else {
    // Nếu không, tạo challenge ngẫu nhiên
    challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
  }

  // Tạo options cho get assertion
  const options: PublicKeyCredentialRequestOptions = {
    challenge: challenge,
    rpId: window.location.hostname,
    timeout: 60000,
    userVerification: "preferred",
  };

  // Nếu có credentialId cụ thể, chỉ cho phép credential đó
  if (credentialId && !allowEmpty) {
    options.allowCredentials = [
      {
        id: Buffer.from(credentialId, "hex"),
        type: "public-key",
      },
    ];
  } else if (!credentialId && !allowEmpty) {
    // Nếu không, tạo danh sách tất cả credentials đã lưu
    try {
      const credentialsListStr = localStorage.getItem("webauthnCredentials");
      if (credentialsListStr) {
        const credentialsList = JSON.parse(credentialsListStr) as StoredCredential[];
        if (Array.isArray(credentialsList) && credentialsList.length > 0) {
          options.allowCredentials = credentialsList.map((cred) => ({
            id: Buffer.from(cred.credentialId, "hex"),
            type: "public-key" as PublicKeyCredentialType,
          }));
        }
      }
    } catch (error) {
    }
  }

  try {
    const assertion = (await navigator.credentials.get({
      publicKey: options,
    })) as PublicKeyCredential;

    const response = assertion.response as AuthenticatorAssertionResponse;
    
    // Tìm public key từ localStorage
    let pubKey: Uint8Array | undefined;
    try {
      const credentialsListStr = localStorage.getItem("webauthnCredentials");
      if (credentialsListStr) {
        const credentialsList = JSON.parse(credentialsListStr) as StoredCredential[];
        const matchingCred = credentialsList.find(
          (cred: StoredCredential) => cred.credentialId === bufferToHex(assertion.rawId)
        );
        if (matchingCred && matchingCred.publicKey) {
          pubKey = Buffer.from(matchingCred.publicKey, "hex");
        }
      }
    } catch (error) {
      console.warn("Không thể lấy public key từ localStorage:", error);
    }

    return {
      signature: new Uint8Array(response.signature),
      authenticatorData: new Uint8Array(response.authenticatorData),
      clientDataJSON: new Uint8Array(response.clientDataJSON),
      pubKey
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Lưu thông tin credential vào localStorage
 */
function saveCredentialInfo(
  credentialId: string,
  publicKey: string,
  userId: Uint8Array,
  displayName: string,
): void {
  try {
    // Chuẩn bị thông tin credential để lưu
    const credentialInfo: StoredCredential = {
      credentialId,
      publicKey,
      userId: Array.from(userId), // Chuyển Uint8Array thành Array để có thể serialize
      displayName,
      createdAt: new Date().toISOString(),
    };

    // Lưu vào danh sách credentials
    let credentialsList = [];
    try {
      const credentialsListStr = localStorage.getItem("webauthnCredentials");
      if (credentialsListStr) {
        credentialsList = JSON.parse(credentialsListStr);
      }
    } catch (storageError) {
    }

    // Thêm credential mới vào danh sách
    credentialsList.push(credentialInfo);

    try {
      localStorage.setItem(
        "webauthnCredentials",
        JSON.stringify(credentialsList),
      );
    } catch (saveError) {
    }
  } catch (error) {
  }
}

/**
 * Xác thực để đăng nhập bằng WebAuthn với credential ID đã biết
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
    if (!isWebAuthnSupported()) {
      throw new Error("WebAuthn không được hỗ trợ trên trình duyệt này");
    }

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    // Tạo options cho get assertion
    const options: PublicKeyCredentialRequestOptions = {
      challenge: challenge,
      timeout: 60000,
      userVerification: "preferred",
    };

    // Nếu có credential ID, thêm vào allowCredentials
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
      throw new Error("Credential ID không được cung cấp");
    }

    // Nếu không có credential ID và allowEmpty = true,
    // có thể trình duyệt sẽ hiển thị tất cả credentials có sẵn

    const assertion = (await navigator.credentials.get({
      publicKey: options,
    })) as PublicKeyCredential;

    if (!assertion) {
      throw new Error("Không thể lấy thông tin xác thực WebAuthn");
    }

    return {
      success: true,
      rawId: new Uint8Array(assertion.rawId),
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message || "Không thể xác thực",
    };
  }
};

/**
 * Tạo verification data từ WebAuthn assertion
 * @param assertion - WebAuthn assertion
 * @returns Uint8Array chứa dữ liệu verification (authenticatorData + hash(clientDataJSON))
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

// Thêm kiểu cho credential được lưu trong localStorage
interface StoredCredential {
  credentialId: string;
  publicKey: string;
  userId: number[];
  displayName: string;
  createdAt: string;
}
