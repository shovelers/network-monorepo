import * as uint8arrays from 'uint8arrays';
import { DIDKey as ISODIDKey } from 'iso-did/key'
import * as verifiers from 'iso-signatures/verifiers/rsa.js'

class Channel {
  constructor() {}

  async publish(message) {
    console.log(message)
  }
}

const channel = new Channel()

export class Requester {
  constructor(agent) {
    this.agent = agent
    this.DID = null
    this.requestKeyPair = null
    this.sessionKey = null
  }

  async initiate() {    
    const {requestKeyPair, requestDID } = await this.requestDID()
    const message = requestDID
    await channel.publish(message)
    this.requestKeyPair =  requestKeyPair
    this.DID = requestDID
    return {requestKeyPair, requestDID}
  }

  async negotiate(sessionKeyMessage) {
    this.sessionKey = await this.parseSessionKey(sessionKeyMessage)

    const pin = Array.from(crypto.getRandomValues(new Uint8Array(6))).map(n => n % 9)
    const iv = crypto.getRandomValues(new Uint8Array(16))

    // TODO - add signature of DID to prove ownership
    // TODO - Standardise message envelope
    const msgBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      this.sessionKey,
      uint8arrays.fromString(
        JSON.stringify({
          did: await this.agent.DID(),
          pin: pin
        }),
        "utf8"
      )
    )
    const msg = new Uint8Array(msgBuffer)

    const challenge = JSON.stringify({
      iv: uint8arrays.toString(iv, "base64pad"),
      msg: uint8arrays.toString(msg, "base64pad")
    })

    channel.publish(challenge)
  }

  async parseSessionKey(sessionKeyMessage) {
    const { iv: encodedIV, msg, sessionKey: encodedSessionKey } = JSON.parse(sessionKeyMessage)
    const iv = uint8arrays.fromString(encodedIV, "base64pad")
    const encryptedSessionKey = uint8arrays.fromString(encodedSessionKey, "base64pad")

    const sessionKeyBuffer = await crypto.subtle.decrypt(
      {
        name: "RSA-OAEP"
      },
      this.requestKeyPair.privateKey,
      encryptedSessionKey
    )
  
    const sessionKey = await crypto.subtle.importKey(
      "raw",
      new Uint8Array(sessionKeyBuffer),
      {
        name: "AES-GCM",
        length: 256,
      },
      true,
      [ "encrypt", "decrypt" ]
    )

    const envelopeBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      sessionKey,
      uint8arrays.fromString(msg, "base64pad"),
    )

    const envelope = JSON.parse(uint8arrays.toString(new Uint8Array(envelopeBuffer)))

    if (envelope.message.audience != this.DID) {
      throw "audience check failed"
    }

    if (envelope.message.sessionKey != uint8arrays.toString(new Uint8Array(sessionKeyBuffer), "base64pad")) {
      throw "session key mismatch"
    }

    const verified = await verify(envelope.message, envelope.signature)
    if (!verified) {
      throw "envelope signature check failed"
    }

    return sessionKey
  }

  //Private
  async requestDID() {
    let keyPair = await crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([ 0x01, 0x00, 0x01 ]),
        hash: { name: "SHA-256" }
      },
      true,
      [ "encrypt", "decrypt" ]
    )

    const buffer = await crypto.subtle.exportKey("spki", keyPair.publicKey)
    let publicKey = new Uint8Array(buffer)

    const requestDID = await DIDKey.publicKeytoDID(publicKey)

    return {requestKeyPair: keyPair, requestDID: requestDID}
  }
}

async function verify(message, signature){
  const pubKey = ISODIDKey.fromString(message.signer).publicKey
  const binMessage = uint8arrays.fromString(JSON.stringify(message)) 
  const binSignature = uint8arrays.fromString(signature, 'base64')
  return await verifiers.verify({message: binMessage, signature: binSignature, publicKey: pubKey})
}

export class Approver {
  constructor(agent) {
    this.agent = agent
  }

  async initiate(requestDID) {
    const {sessionKey, sessionKeyMessage} = await this.sessionKey(requestDID)
    await channel.publish(sessionKeyMessage)
    return {sessionKey, sessionKeyMessage}
  }

  async sessionKey(requestDID) {
    const sessionKey = await crypto.subtle.generateKey(
      {
        name: 'AES-GCM', length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    )

    const buffer = await crypto.subtle.exportKey("raw", sessionKey)
    const exportedSessionKey = new Uint8Array(buffer)

    const publicKey = DIDKey.DIDtoPublicKey(requestDID)
    const requesterPublicKey = await crypto.subtle.importKey(
      "spki",
      publicKey,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      [ "encrypt" ]
    )

    const arrayBuffer = await crypto.subtle.encrypt(
      {
        name: "RSA-OAEP"
      },
      requesterPublicKey,
      exportedSessionKey
    )
    const encryptedSessionKey = new Uint8Array(arrayBuffer)

    const data = {
      // issuer: //agentDID,
      audience: requestDID,
      sessionKey: uint8arrays.toString(exportedSessionKey, "base64pad")
    }
    const envolope = await this.agent.envelop(data)
    const encodedEnvelope = uint8arrays.fromString(JSON.stringify(envolope))

    const iv = crypto.getRandomValues(new Uint8Array(16))

    const msgBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      sessionKey,
      encodedEnvelope
    )
    const msg = new Uint8Array(msgBuffer)

    const sessionKeyMessage = JSON.stringify({
      iv: uint8arrays.toString(iv, "base64pad"),
      msg: uint8arrays.toString(msg, "base64pad"),
      sessionKey: uint8arrays.toString(encryptedSessionKey, "base64pad")
    })
  
    return {
      sessionKey,
      sessionKeyMessage
    }
  }

}

const BASE58_DID_PREFIX = "did:key:z"
const rsaMagicBytes = new Uint8Array([ 0x00, 0xf5, 0x02 ])

class DIDKey {
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