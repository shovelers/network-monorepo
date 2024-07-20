import { Handshake } from './base/handshake.js';
import * as uint8arrays from 'uint8arrays';

export class JoinHandshake extends Handshake {
  async confirmData() {
    let memberDirectoryAccessKey = await this.agent.getAccessKeyForPrivateFile('members.json')
    let encodedMemberDirectoryAccessKey = uint8arrays.toString(memberDirectoryAccessKey.toBytes(), 'base64url');
    
    let communityContactsAccessKey = await this.agent.getAccessKeyForPrivateFile('contacts.json')
    let encodedCommunityContactsAccessKey = uint8arrays.toString(communityContactsAccessKey.toBytes(), 'base64url');

    console.log("preparing community info to be shared in join handshake...")
 
    return {
      community: {
        FN: await this.agent.handle(),
        UID: `DCN:${await this.agent.accountDID()}`,
        PRODID: "DCN:rolodex",
        XML: `members.json:${await this.agent.handle()}.${encodedMemberDirectoryAccessKey}|contacts.json:${await this.agent.handle()}.${encodedCommunityContactsAccessKey}`
      }
    }
  }
}