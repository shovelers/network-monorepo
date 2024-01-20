import * as uint8arrays from 'uint8arrays';
import { Envelope, DIDKey, channel } from './common.js';

export class Approver {
  constructor(agent) {
    this.agent = agent
    this.sessionKey = null
    this.message = null
  }

  async initiate(requestDID) {
    const {sessionKey, sessionKeyMessage} = await this.generateSessionKey(requestDID)
    this.sessionKey =  sessionKey
    await channel.publish(sessionKeyMessage)
    return {sessionKey, sessionKeyMessage}
  }

  async negotiate(challenge) {
    this.message = await Envelope.open(challenge, this.sessionKey)
    // TODO do something with challenge pin

    let approver = this
    return {
      confirm: async () => { return await approver.confirm() },
      reject: async () => { return await approver.reject() },
      message: this.message
    }
  }

  async confirm() {
    // TODO session.AddAgent
    const rootKey = await this.agent.accessKey()
    const confirmMessage = await Envelope.pack({accessKey: rootKey, status: "CONFIRMED"}, this.sessionKey)
    
    await channel.publish(confirmMessage)
    return confirmMessage
  }

  async reject() {
    const rejectMessage = await Envelope.pack({ status: "REJECTED" }, this.sessionKey)
    
    await channel.publish(rejectMessage)
    return rejectMessage
  }

  async generateSessionKey(requestDID) {
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