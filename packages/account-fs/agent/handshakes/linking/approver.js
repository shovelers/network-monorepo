import { Approver, Handshake } from '../base/approver.js';
import * as uint8arrays from 'uint8arrays';

export class LinkingHandshake extends Handshake {
  async confirmData() {
    const handle = await this.agent.handle()
    const rootKey = uint8arrays.toString(await this.agent.accessKey(), 'base64pad')
    const forestCID = uint8arrays.toString(await this.agent.forestCID(), 'base64pad')
    return { handle: handle, accessKey: rootKey, forestCID: forestCID }
  }
}

export class LinkingApprover extends Approver {
  async handler(message) {
    if (this.handshake == null) {
      const request = JSON.parse(message)
      this.handshake = new LinkingHandshake(this.agent, this.channel, request.id, this.notification, this.onComplete)
      await this.handshake.initiate(message)
    } else {
      await this.handshake.handler(message)
    }
  }
}