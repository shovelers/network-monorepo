import * as uint8arrays from 'uint8arrays';
import { DIDKey as ISODIDKey } from 'iso-did/key'
import * as verifiers from 'iso-signatures/verifiers/rsa.js'
import { Envelope, DIDKey, PinEvent } from './common.js';

async function verify(message, signature){
  const pubKey = ISODIDKey.fromString(message.signer).publicKey
  const binMessage = uint8arrays.fromString(JSON.stringify(message)) 
  const binSignature = uint8arrays.fromString(signature, 'base64')
  return await verifiers.verify({message: binMessage, signature: binSignature, publicKey: pubKey})
}

export class Requester {
  constructor(agent, channel) {
    this.agent = agent
    this.channel = channel
    this.DID = null
    this.requestKeyPair = null
    this.sessionKey = null
    this.state = null
    this.pinTarget = new PinEvent()
  }

  async handler(message) {
    switch (this.state) {
      case "INITIATE":
        this.state = "NEGOTIATE"
        this.negotiate(message)
        break
      case "NEGOTIATE":
        this.state = "TERMINATE"
        this.complete(message)
        break
      case "TERMINATE":
        break
    }
  }

  async initiate() {    
    const {requestKeyPair, requestDID } = await this.requestDID()
    const message = requestDID
    this.state = "INITIATE"
    await this.channel.publish(message)
    this.requestKeyPair =  requestKeyPair
    this.DID = requestDID
    return {requestKeyPair, requestDID}
  }

  async negotiate(sessionKeyMessage) {
    this.sessionKey = await this.parseSessionKey(sessionKeyMessage)
    const pin = Array.from(crypto.getRandomValues(new Uint8Array(6))).map(n => n % 9)

    // TODO - add signature of DID to prove ownership
    const challenge = await Envelope.pack({
      did: await this.agent.DID(),
      pin: pin
    }, this.sessionKey)

    this.channel.publish(challenge)

    this.pinTarget.emitGenerateEvent(pin)
    return { challenge, pin }
  }

  async complete(envelope) {
    const message = await Envelope.open(envelope, this.sessionKey)
    if (message.status == "CONFIRMED") {
      // TODO Save access key
      console.log(message.accessKey)
    }
    console.log(message.status)
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