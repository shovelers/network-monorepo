import { Approver } from '../base/approver.js';
import { Envelope } from '../base/common.js';
import * as uint8arrays from 'uint8arrays';

export class LinkingApprover extends Approver {
  async negotiate(challenge) {
    const message = await Envelope.open(challenge, this.sessionKey)

    let approver = this
    this.notification.emitEvent("pinRecieved", {
      confirm: async () => { return await approver.confirm(message) },
      reject: async () => { return await approver.reject() },
      message: message
    })

    return {
      confirm: async () => { return await approver.confirm() },
      reject: async () => { return await approver.reject() },
      message: message
    }
  }

  async confirm(message) {
    console.log("message in approve#confirm", message)
    await this.onComplete.call("", message)
    const handle = await this.agent.handle()
    const rootKey = uint8arrays.toString(await this.agent.accessKey(), 'base64pad')
    const forestCID = uint8arrays.toString(await this.agent.forestCID(), 'base64pad')
    const confirmMessage = await Envelope.pack({handle: handle, accessKey: rootKey, forestCID: forestCID, status: "CONFIRMED"}, this.sessionKey)
    
    await this.channel.publish(confirmMessage)
    this.notification.emitEvent("complete", "CONFIRMED")
    return confirmMessage
  }

  async reject() {
    const rejectMessage = await Envelope.pack({ status: "REJECTED" }, this.sessionKey)
    
    await this.channel.publish(rejectMessage)
    this.notification.emitEvent("complete", "REJECTED")
    return rejectMessage
  }
}