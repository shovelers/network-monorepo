import { Handshake } from './base/handshake.js';
import { Requester } from './base/requester.js';
import * as uint8arrays from 'uint8arrays';

export class JoinHandshake extends Handshake {
  async confirmData() {
    console.log("confirm data ...")
    const accessKey = await this.agent.getAccessKeyForPrivateFile('members.json')
    const accessKeyString = uint8arrays.toString(accessKey.toBytes(), 'base64url')
    return { members: { accessKey: accessKeyString } }
  }
}

export class JoinRequester extends Requester {
  type() {
    return "JOIN"
  }

  async challenge() {
    //send profile.json accesskey
    console.log("challenge data ...")
    const accessKey = await this.agent.getAccessKeyForPrivateFile('profile.json')
    const accessKeyString = uint8arrays.toString(accessKey.toBytes(), 'base64url')
    return { profile: { accessKey: accessKeyString } }
  }
}