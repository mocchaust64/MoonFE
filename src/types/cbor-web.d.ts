declare module "cbor-web" {
  type CBORValue =
    | string
    | number
    | boolean
    | null
    | CBORValue[]
    | { [key: string]: CBORValue };

  interface CBORMap {
    get(key: number): CBORValue;
    has(key: number): boolean;
  }

  interface AttestationObject {
    authData: Uint8Array;
    fmt: string;
    attStmt: { [key: string]: CBORValue };
  }

  interface COSEKey {
    get(key: number): Uint8Array;
    has(key: number): boolean;
  }

  // Type guards
  export function isAttestationObject(obj: unknown): obj is AttestationObject;
  export function isCOSEKey(obj: unknown): obj is COSEKey;

  // Overloads for decode function
  export function decode(data: Uint8Array | ArrayBuffer): CBORValue;
  export function decode(data: Uint8Array | ArrayBuffer): AttestationObject;
  export function decode(data: Uint8Array | ArrayBuffer): COSEKey;

  export function encode(data: CBORValue): Uint8Array;
  export function encodeCanonical(data: CBORValue): Uint8Array;

  // Overloads for decodeFirst function
  export function decodeFirst(data: Uint8Array | ArrayBuffer): CBORValue;
  export function decodeFirst(
    data: Uint8Array | ArrayBuffer,
  ): AttestationObject;
  export function decodeFirst(data: Uint8Array | ArrayBuffer): COSEKey;

  export function decodeAll(
    data: Uint8Array | ArrayBuffer,
  ): (CBORValue | AttestationObject | COSEKey)[];

  export class Encoder {
    push(value: CBORValue): void;
    finalize(): Uint8Array;
  }

  export class Decoder {
    decode(
      data: Uint8Array | ArrayBuffer,
    ): CBORValue | AttestationObject | COSEKey;
  }

  export class Tagged {
    constructor(tag: number, value: CBORValue);
    tag: number;
    value: CBORValue;
  }

  export class Simple {
    constructor(value: number);
    value: number;
  }
}
