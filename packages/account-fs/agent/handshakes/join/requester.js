import { Requester } from '../base/requester.js';

export class JoinRequester extends Requester {
  async challenge() {
    const handle = await this.agent.handle()
    return { profile: { handle: handle } }
  }
}