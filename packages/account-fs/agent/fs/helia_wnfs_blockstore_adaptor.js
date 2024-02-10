import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import { fromString, toString } from 'uint8arrays'

export class WnfsBlockstore {
  constructor(node) {
    this.helia = node
  }

  async getBlock (cid){
    const decoded_cid = CID.decode(cid)
    const content = this.helia.blockstore.get(decoded_cid)
    return content
  }
  
  async putBlock (bytes, codec){
    const multihash = await sha256.digest(bytes)
    const cid = CID.createV1(codec, multihash)
    this.helia.blockstore.put(cid, bytes)
    return cid.bytes
  }
}

export class Rng {
  randomBytes(count) {
    const array = new Uint8Array(count);
    crypto.getRandomValues(array);
    return array;
  }
}

export class ExchangeKey {
  constructor(key) {
    this.key = key;
  }

  static async fromModulus(modulus) {
    var keyData = {
      kty: "RSA",
      n: toString(modulus, "base64url"),
      e: toString(new Uint8Array([0x01, 0x00, 0x01]), "base64url"),
      alg: "RSA-OAEP-256",
      ext: true,
    };

    const key = await crypto.subtle.importKey(
      "jwk",
      keyData,
      {
        name: "RSA-OAEP",
        hash: { name: "SHA-256" },
      },
      false,
      ["encrypt"]
    );

    return new ExchangeKey(key);
  }

  async encrypt(data) {
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: "RSA-OAEP",
      },
      this.key,
      data
    );
    return new Uint8Array(encryptedData);
   //const encryptedData = await crypto.publicEncrypt({key: this.key, oaepHash: "SHA-256", padding: crypto.constants.RSA_NO_PADDING}, data)

    return new Uint8Array(encryptedData);
  }

  async getPublicKeyModulus() {
    const key = await crypto.subtle.exportKey("jwk", this.key);
    return fromString(key.n, "base64url");
  }
}

export class PrivateKey {
  constructor(key) {
    this.key = key;
  }

  static async generate(){
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
        hash: { name: "SHA-256" },
      },
      true,
      ["encrypt", "decrypt"]
    );

    return new PrivateKey(keyPair);
  }

  async decrypt(data) {
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: "RSA-OAEP",
      },
      this.key.privateKey,
      data
    );

    return new Uint8Array(decryptedData);
  }

  getPublicKey() {
    return new ExchangeKey(this.key.publicKey);
  }
}