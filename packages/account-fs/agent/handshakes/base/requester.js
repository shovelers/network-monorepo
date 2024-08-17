import * as uint8arrays from 'uint8arrays';
import { DIDKey as ISODIDKey } from 'iso-did/key'
import * as verifiers from 'iso-signatures/verifiers/rsa.js'
import { Envelope, DIDKey, Notification } from './common.js';
import { Channel } from './channel.js';

async function verify(message, signature){
  const pubKey = ISODIDKey.fromString(message.signer).publicKey
  const binMessage = uint8arrays.fromString(JSON.stringify(message)) 
  const binSignature = uint8arrays.fromString(signature, 'base64')
  return await verifiers.verify({message: binMessage, signature: binSignature, publicKey: pubKey})
}

class RequesterHandshake {
  constructor(agent, channel, type) {
    this.agent = agent
    this.channel = channel
    this.DID = null
    this.requestKeyPair = null
    this.sessionKey = null
    this.state = null
    this.notification = new Notification()
    this.type = type
  }

  async handler(message) {
    switch (this.state) {
      case "INITIATED":
        this.negotiate(message)
        break
      case "NEGOTIATED":
        this.complete(message)
        break
      case "TERMINATED":
        break
    }
  }

  async initiate() {    
    const {requestKeyPair, requestDID } = await this.requestDID()
    const message = { id: requestDID, type: this.type }
    this.requestKeyPair =  requestKeyPair
    this.DID = requestDID
    await this.channel.publishViaForwarder(JSON.stringify(message))
    this.state = "INITIATED"
    return requestDID
  }

  async negotiate(message) {
    const { id, type, iv, msg, sessionKey, challenge } = JSON.parse(message)
    if (!id || !type || !iv || !sessionKey) {
      console.log("ignoring invalid negotiate message")
      return
    }

    this.sessionKey = await this.parseSessionKey(iv, msg, sessionKey)    
    const challengeData = await Envelope.open(challenge, this.sessionKey)
    
    let requester = this
    this.notification.emitEvent("challengeIntiated", {
      challenge: challengeData,
      submit: async (challengeSubmission) => { 
        const response = await Envelope.pack({
          did: await this.agent.DID(),
          challenge: challengeSubmission
        }, this.sessionKey, id, type)
    
        requester.notification.emitEvent("challengeGenerated", challengeSubmission)
        return await requester.channel.publish(response)
      },
      channelName: this.channel.name
    })  

    // TODO - add signature of DID to prove ownership
    this.state = "NEGOTIATED"
  }

  async complete(envelope) {
    const { id, type, iv, msg } = JSON.parse(envelope)
    if (!id || !type || !iv || !msg) {
      console.log("ignoring invalid complete message")
      return
    }

    const message = await Envelope.open(envelope, this.sessionKey)
    if (message.status == "CONFIRMED") {
      this.notification.emitEvent("complete", "")
    }
    this.notification.emitEvent(message.status, message)
    this.state = "TERMINATED"
    console.log(message.status)
  }

  async parseSessionKey(encodedIV, msg, encodedSessionKey) {
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

export class Requester {
  constructor(agent) {
    this.agent = agent
    this.handshakes = []
  }

  async create(approverDID, handshakeType, brokerDID=null) {
    let forwardingChannel = (brokerDID) ? `${brokerDID}-forwarding` : null
    const channel = new Channel(this.agent.helia, `${approverDID}-approver`, forwardingChannel)

    let handshake = new RequesterHandshake(this.agent, channel, handshakeType)
    await channel.subscribe(handshake)

    this.handshakes.push(handshake)
    return handshake
  }
}