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
    let sharedProfile = new SharedProfileRepository(this.agent, communityDID)

    const communityProfile = {
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

    await sharedProfile.set(communityProfile, profileSchema)
    console.log("Profile after save :", profile, communityProfile)
  }

  async contactForHandshake(communityDID) {
    let accountDID = await this.agent.accountDID()
    let profile = await this.get()
    let profileAccessKey = await this.agent.getAccessKeyForPrivateFile(this.filename)
    let encodedProfileAccessKey = uint8arrays.toString(profileAccessKey.toBytes(), 'base64');
    let xml = `profile.json:${profile.handle}.${encodedProfileAccessKey}`

    if (communityDID) {
      let sharedProfile = new SharedProfileRepository(this.agent, communityDID)
      let exists = await sharedProfile.isInitialised()
      if (exists) {
        let accessKey = await this.agent.getAccessKeyForPrivateFile(sharedProfile.filename)
        let encodedAccessKey = uint8arrays.toString(accessKey.toBytes(), 'base64url');    
        xml = `${xml}|${sharedProfile.filename}:${encodedAccessKey}`
      }
    }
  
    return {
      FN: profile.name,
      UID: `DCN:${accountDID}`,
      PRODID: "DCN:rolodex",
      XML: xml
    }
  }
}