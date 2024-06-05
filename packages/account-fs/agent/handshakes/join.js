import { Handshake } from './base/handshake.js';
import { Requester } from './base/requester.js';
import * as uint8arrays from 'uint8arrays';

export class JoinHandshake extends Handshake {
  async confirmData() {
    let memberDirectoryAccessKey = await this.agent.getAccessKeyForPrivateFile('members.json')
    let encodedMemberDirectoryAccessKey = uint8arrays.toString(memberDirectoryAccessKey.toBytes(), 'base64url');
 
    return {
      community: {
        FN: await this.agent.handle(),
        UID: `DCN:${await this.agent.accountDID()}`,
        PRODID: "DCN:rolodex",
        XML: `members.json:${await this.agent.handle()}.${encodedMemberDirectoryAccessKey}`
      }
    }
  }
}

export class JoinRequester extends Requester {
  type() {
    return "JOIN"
  }

  async challenge() {
  }
}