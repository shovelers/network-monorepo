import * as uint8arrays from 'uint8arrays';
import { Envelope, DIDKey } from './common.js';

export class Handshake {
  constructor(agent, channel, id) {
    this.agent = agent
    this.channel = channel
    this.id = id
    this.state = "CREATED"
    this.sessionKey = undefined
    this.brokerDID = undefined
    this.incoming = {}
  }

  async handle(message) {
    switch (this.state) {
      case "CREATED": 
        await this.initiate(message)
        break
      case "INITIATED":
        await this.negotiate(message)
        break
      case "NEGOTIATED":
        break
      case "TERMINATED":
        break
    }
  }

  async initiate(message) {
    this.state = "INITIATED"
    this.incoming[this.state] = message
  }

  async challenge(data) {
    const message = this.incoming[this.state]

    const request = JSON.parse(message)
    const {sessionKey, sessionKeyMessage} = await this.generateSessionKey(request)
    this.sessionKey = sessionKey

    // TODO: create package once, hack to stick in one more field
    const outgoing = JSON.parse(sessionKeyMessage)
    outgoing.challenge = await Envelope.pack(data, this.sessionKey, outgoing.id, outgoing.type)
    await this.channel.publish(JSON.stringify(outgoing))
  }

  async negotiate(message) {
    this.state = "NEGOTIATED"
    this.incoming[this.state] = message
  }

  async challengeSubmission(){
    const message = await Envelope.open(this.incoming["NEGOTIATED"], this.sessionKey)
    return message.challenge
  }

  async confirm(data) {
    console.log("message in approve#confirm")

    const message = this.incoming[this.state]
    const { id, type } = JSON.parse(message)
    const confirmMessage = await Envelope.pack({data: data, status: "CONFIRMED"}, this.sessionKey, id, type)
    
    await this.channel.publish(confirmMessage)
    this.state = "TERMINATED"
  }

  async reject() {
    console.log("message in approve#reject")

    const message = this.incoming[this.state]
    const { id, type } = JSON.parse(message)
    const rejectMessage = await Envelope.pack({ status: "REJECTED" }, this.sessionKey, id, type)
    
    await this.channel.publish(rejectMessage)
    this.state = "TERMINATED"
  }

  async generateSessionKey(message) {
    const requestDID = message.id
    const handshakeType = message.type
    this.brokerDID = message.brokerDID
    const sessionKey = await crypto.subtle.generateKey(
      {
        name: 'AES-GCM', length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    )

    const buffer = await crypto.subtle.exportKey("raw", sessionKey)
    const exportedSessionKey = new Uint8Array(buffer)

    const encryptedSessionKey = await this.encryptSessionKey(exportedSessionKey, requestDID)
    const encryptedBrokerSessionKey = (this.brokerDID) ? await this.encryptSessionKey(exportedSessionKey, this.brokerDID) : undefined
    const brokerSessionKey = (encryptedBrokerSessionKey) ? uint8arrays.toString(encryptedBrokerSessionKey, "base64pad") : undefined

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
      id: message.id,
      type: handshakeType,
      iv: uint8arrays.toString(iv, "base64pad"),
      msg: uint8arrays.toString(msg, "base64pad"),
      sessionKey: uint8arrays.toString(encryptedSessionKey, "base64pad"),
      brokerSessionKey: brokerSessionKey
    })
  
    return {
      sessionKey,
      sessionKeyMessage
    }
  }

  async encryptSessionKey(exportedSessionKey, did) {
    const publicKey = DIDKey.DIDtoPublicKey(did)
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
    return new Uint8Array(arrayBuffer)
  }
}