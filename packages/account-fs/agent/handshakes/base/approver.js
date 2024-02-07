import * as uint8arrays from 'uint8arrays';
import { Envelope, DIDKey, Notification } from './common.js';

export class Handshake {
  constructor(agent, channel, id, notification, onComplete) {
    this.agent = agent
    this.channel = channel
    this.id = id
    this.state = "CREATED"
    this.notification = notification
    this.onComplete = onComplete
    this.sessionKey = undefined
    this.brokerDID = undefined
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
    const request = JSON.parse(message)
    const {sessionKey, sessionKeyMessage} = await this.generateSessionKey(request)
    this.sessionKey = sessionKey
    await this.channel.publish(sessionKeyMessage)
    this.state = "INITIATED"
  }

  async negotiate(message) {
    const challengeMessage = await Envelope.open(message, this.sessionKey)

    let approver = this
    this.notification.emitEvent("challengeRecieved", {
      confirm: async () => { return await approver.confirm(message, challengeMessage) },
      reject: async () => { return await approver.reject(message) },
      message: challengeMessage
    })
    this.state = "NEGOTIATED"
  }

  async confirm(message, challenge) {
    console.log("message in approve#confirm", challenge)
    await this.onComplete.call("", challenge)
    const data = await this.confirmData()

    const id = JSON.parse(message).id
    const confirmMessage = await Envelope.pack({data: data, status: "CONFIRMED"}, this.sessionKey, id)
    
    await this.channel.publish(confirmMessage)
    this.notification.emitEvent("complete", "CONFIRMED")
    this.state = "TERMINATED"
  }

  async confirmData() {
    throw "ImplementInSpecificHandshake"
  }

  async reject(message) {
    const id = JSON.parse(message).id
    const rejectMessage = await Envelope.pack({ status: "REJECTED" }, this.sessionKey, id)
    
    await this.channel.publish(rejectMessage)
    this.notification.emitEvent("complete", "REJECTED")
    this.state = "TERMINATED"
  }

  async generateSessionKey(message) {
    const requestDID = message.id
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

export class Approver {
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
      handshake = this.newHandshake(request.id)
      this.handshakes.push(handshake)
    } 
    await handshake.handle(message)
  }

  newHandshake(id) {
    return new Handshake(this.agent, this.channel, id, this.notification, this.onComplete)
  }
}