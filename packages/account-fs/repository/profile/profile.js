import * as uint8arrays from 'uint8arrays';
import { SharedProfileRepository } from './shared_profile';

export class ProfileRepository {
  constructor(agent) {
    this.agent = agent
    this.filename = "profile.json" 
  }

  async initialise(){
    const exists = await this.agent.fileExists(this.filename)
    if (!exists) {
      await this.agent.updatePrivateFile(this.filename, () => { return {} })
    }
  }

  async get(){
    return await this.agent.readPrivateFile(this.filename)
  }

  async set(params){
    let profile = await this.get()

    await this.agent.updatePrivateFile(this.filename, (content) => {
      content = {...profile, ...params}
      return content
    })
  }

  async createCommunityProfile(communityDID, profileSchema, inputs) {
    let profile = await this.get()
    let sharedProfile = new SharedProfileRepository(this.agent, profileSchema, communityDID)

    const sampleProfile = {
      "inputs": inputs,
      "socials": [
        {
          "prodid": "farcaster",
          "displayName": profile.name,
          "username": profile.handle,
          "bio": profile.text,
          "pfpUrl": profile.pfpUrl
        },
      ],
      "version": 1
    }

    console.log("Profile after save :", profile, sampleProfile)
    await sharedProfile.set(sampleProfile)
  }

  async contactForHandshake() {
    let accountDID = await this.agent.accountDID()
    let profile = await this.get()
    let profileAccessKey = await this.agent.getAccessKeyForPrivateFile(this.filename)
    let encodedProfileAccessKey = uint8arrays.toString(profileAccessKey.toBytes(), 'base64');
  
    return {
      FN: profile.name,
      UID: `DCN:${accountDID}`,
      PRODID: "DCN:rolodex",
      XML: `profile.json:${profile.handle}.${encodedProfileAccessKey}`
    }
  }
}