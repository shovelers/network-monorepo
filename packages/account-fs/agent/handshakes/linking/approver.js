import { Approver } from '../base/approver.js';
import * as uint8arrays from 'uint8arrays';

export class LinkingApprover extends Approver {
  async confirmData() {
    const handle = await this.agent.handle()
    const rootKey = uint8arrays.toString(await this.agent.accessKey(), 'base64pad')
    const forestCID = uint8arrays.toString(await this.agent.forestCID(), 'base64pad')
    return { handle: handle, accessKey: rootKey, forestCID: forestCID }
  }
}