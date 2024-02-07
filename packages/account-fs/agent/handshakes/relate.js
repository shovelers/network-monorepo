import { Approver, Handshake } from './base/approver.js';
import { Requester } from './base/requester.js';
import { Channel } from './channel.js';
import { DIDKey, Notification } from './base/common.js';

export class RelateHandshake extends Handshake {
  async confirmData() {
    return { }
  }
}

export class RelateApprover extends Approver {
  newHandshake(id) {
    return new RelateHandshake(this.agent, this.channel, id, this.notification, this.onComplete)
  }
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
    // TODO - can store messages to implement relationship chain
    console.log("snooped", message)
  }

  async initiate(message) {
    const { keyPair, tempDID } = await this.tempDID()
    this.keyPair = keyPair
    this.DID = tempDID
    message.brokerDID = tempDID
    // TODO add proof of brokerDID from a valid broker or pass the permanent brokerDID instead of a throwaway

    await this.channel.publish(JSON.stringify(message))
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

export class RelateBroker {
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


export class RelateRequester extends Requester {
  async challenge() {
    return { }
  }
}