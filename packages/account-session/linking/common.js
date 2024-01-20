import * as uint8arrays from 'uint8arrays';

class Channel {
  constructor() {}

  async publish(message) {
    console.log(message)
  }
}

export const channel = new Channel()

export class Envelope {
  static async pack(message, sessionKey){
    const iv = crypto.getRandomValues(new Uint8Array(16))

    const msgBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      sessionKey,
      uint8arrays.fromString(JSON.stringify(message),"utf8")
    )
    const msg = new Uint8Array(msgBuffer)

    return JSON.stringify({
      iv: uint8arrays.toString(iv, "base64pad"),
      msg: uint8arrays.toString(msg, "base64pad")
    })
  }
  
  static async open(envelope, sessionKey) {
    const { iv: encodedIV, msg } = JSON.parse(envelope)
    const iv = uint8arrays.fromString(encodedIV, "base64pad")

    const messageBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      sessionKey,
      uint8arrays.fromString(msg, "base64pad"),
    )
    return JSON.parse(uint8arrays.toString(new Uint8Array(messageBuffer), "utf8"))
  }
}


const BASE58_DID_PREFIX = "did:key:z"
const rsaMagicBytes = new Uint8Array([ 0x00, 0xf5, 0x02 ])

// TODO check if can be replaced with ISO DID
export class DIDKey {
  static async publicKeytoDID(publicKey){
    const prefixedBuf = uint8arrays.concat([ rsaMagicBytes, publicKey ])

    return BASE58_DID_PREFIX + uint8arrays.toString(prefixedBuf, "base58btc")
  }

  static DIDtoPublicKey(did) {
    if (!did.startsWith(BASE58_DID_PREFIX)) {
      throw new Error("Please use a base58-encoded DID formatted `did:key:z...`")
    }

    const didWithoutPrefix = did.substr(BASE58_DID_PREFIX.length)
    const magicalBuf = uint8arrays.fromString(didWithoutPrefix, "base58btc")

    for (let i=0; i<rsaMagicBytes.length; i++) {
      if (magicalBuf[i] != rsaMagicBytes[i]) {
        throw new Error("Unsupported key algorithm.")
      }
    }

    return magicalBuf.slice(rsaMagicBytes.length)
  }
}