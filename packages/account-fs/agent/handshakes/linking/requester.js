import { Requester } from '../base/requester.js';
import { Envelope } from '../base/common.js';

export class LinkingRequester extends Requester {
  async negotiate(sessionKeyMessage) {
    this.sessionKey = await this.parseSessionKey(sessionKeyMessage)
    const pin = Array.from(crypto.getRandomValues(new Uint8Array(6))).map(n => n % 9)

    // TODO - add signature of DID to prove ownership
    const challenge = await Envelope.pack({
      did: await this.agent.DID(),
      pin: pin
    }, this.sessionKey)

    this.channel.publish(challenge)

    this.notification.emitEvent("pinGenerated", pin)
    return { challenge, pin }
  }

  async complete(envelope) {
    const message = await Envelope.open(envelope, this.sessionKey)
    if (message.status == "CONFIRMED") {
      await this.onComplete.call("", message)
      this.notification.emitEvent("complete", "")
    }
    console.log(message.status)
  }
}