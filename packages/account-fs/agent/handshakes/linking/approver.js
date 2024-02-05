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
  newHandshake(id) {
    return new LinkingHandshake(this.agent, this.channel, id, this.notification, this.onComplete)
  }
}