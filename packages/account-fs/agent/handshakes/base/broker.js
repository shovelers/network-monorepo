import { Channel } from './channel.js';
import { Envelope, DIDKey, Notification } from './common.js';
import { DIDKey as ISODIDKey } from 'iso-did/key'
import * as verifiers from 'iso-signatures/verifiers/rsa.js'
import * as uint8arrays from 'uint8arrays';

async function verify(message, signature){
  const pubKey = ISODIDKey.fromString(message.signer).publicKey
  const binMessage = uint8arrays.fromString(JSON.stringify(message)) 
  const binSignature = uint8arrays.fromString(signature, 'base64')
  return await verifiers.verify({message: binMessage, signature: binSignature, publicKey: pubKey})
}

class BrokerHandshake {
  constructor(agent, channel, id) {
    this.id = id
    this.agent = agent
    this.channel = channel
    this.DID = null
    this.keyPair = null
    this.sessionKey = null
    this.state = null
  }

  async handle(message) {
    if (!this.sessionKey) {
      await this.negotiate(message)
    } else {
      await this.read(message)
    }
  }

  async negotiate(message) {
    const { id, iv, msg, brokerSessionKey } = JSON.parse(message)
    if (!id || !iv || !msg || !brokerSessionKey) {
      console.log("ignoring invalid negotiate message")
      return
    }

    this.sessionKey = await this.parseSessionKey(iv, msg, brokerSessionKey)
    console.log("snoop", this.id, this.sessionKey)
  }

  async read(envelope) {
    const { id, iv, msg } = JSON.parse(envelope)
    if (!id || !iv || !msg) {
      console.log("ignoring invalid complete message")
      return
    }

    // TODO - can store messages to implement relationship chain
    const message = await Envelope.open(envelope, this.sessionKey)
    console.log("snoop", message)
  }

  async initiate(message) {
    const { keyPair, tempDID } = await this.tempDID()
    this.keyPair = keyPair
    this.DID = tempDID
    message.brokerDID = tempDID
    // TODO add proof of brokerDID from a valid broker or pass the permanent brokerDID instead of a throwaway

    await this.channel.publish(JSON.stringify(message))
  }

  async parseSessionKey(encodedIV, msg, encodedSessionKey) {
    const iv = uint8arrays.fromString(encodedIV, "base64pad")
    const encryptedSessionKey = uint8arrays.fromString(encodedSessionKey, "base64pad")

    const sessionKeyBuffer = await crypto.subtle.decrypt(
      {
        name: "RSA-OAEP"
      },
      this.keyPair.privateKey,
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
    async tempDID() {
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
  
      return {keyPair: keyPair, tempDID: requestDID}
    }
}

export class Broker {
  constructor(agent, channel, onComplete) {
    this.agent = agent
    this.channel = channel
    this.notification = new Notification()
    this.onComplete = onComplete
    this.handshakes = []
  }

  async handler(message) {
    const request = JSON.parse(message)
    let handshake = this.handshakes.find((h) => h.id == request.id)

    if (!handshake) {
      handshake = await this.newHandshake(message)
      this.handshakes.push(handshake)
      return
    } 
    await handshake.handle(message)
  }

  async newHandshake(packet) {
    const { topic, message } = JSON.parse(packet)
    if (!topic || !message) {
      console.log("ignoring invalid forwarding message")
      return
    }

    const channel = new Channel(this.agent.helia, topic)
    const handshake = new BrokerHandshake(this.agent, channel, message.id)

    await channel.subscribe(this)
    const timeout = setTimeout(() => {
      clearTimeout(timeout)
      handshake.initiate(message)
    }, 1)

    return handshake
  }
}