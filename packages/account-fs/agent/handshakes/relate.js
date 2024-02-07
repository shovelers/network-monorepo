import { Approver, Handshake } from './base/approver.js';
import { Requester } from './base/requester.js';
import { Channel } from './channel.js';
import { DIDKey } from './base/common.js';

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

export class RelateBroker {
  constructor(helia) {
    this.helia = helia
  }

  async handler(packet) {
    const { topic, message } = JSON.parse(packet)
    if (!topic || !message) {
      console.log("ignoring invalid forwarding message")
      return
    }

    const channel = new Channel(this.helia, topic)
    // TODO - can store messages to implement relationship chain

    // TODO - store keypair and DID to follow messages
    const {keyPair, tempDID } = await this.tempDID()
    message.brokerDID = tempDID
    // TODO add proof of brokerDID from a valid broker or pass the permanent brokerDID instead of a throwaway

    await channel.subscribe(this)
    const timeout = setTimeout(() => {
      clearTimeout(timeout)
      channel.publish(JSON.stringify(message))
    }, 1)
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

export class RelateRequester extends Requester {
  async challenge() {
    return { }
  }
}