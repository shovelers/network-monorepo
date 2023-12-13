import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import crypto from 'crypto'

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
      ["decrypt"]
    );

    return new PrivateKey(keyPair);
  }

  async decrypt(data) {
    const decryptedData = await window.crypto.subtle.decrypt(
      {
        name: "RSA-OAEP",
      },
      this.key.privateKey,
      data
    );

    return new Uint8Array(decryptedData);
  }

  getPublicKey() {
    return this.key.publicKey;
  }
}