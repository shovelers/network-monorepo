import * as uint8arrays from 'uint8arrays';
import { SharedProfileRepository } from './shared_profile';
import { Profile } from './profile';

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

  async get(communityDID = null){
    if (communityDID) {
      let sharedProfile = new SharedProfileRepository(this.agent, communityDID)
      let exists = await sharedProfile.isInitialised()
      if (exists) {
        return await sharedProfile.get()
      } else {
        const data = await this.agent.readPrivateFile(this.filename)
        return Profile.createFromOldProfileJson(data)
      }
    }

    return await this.agent.readPrivateFile(this.filename)
  }

  async set(params){
    let profile = await this.get()

    await this.agent.updatePrivateFile(this.filename, (content) => {
      content = {...profile, ...params}
      return content
    })
  }

  async updateTelegramInCommunityProfile(communityDID, profileSchema, telegramProfile){
    //TODO: set value in telegram.json
    //await TelegramProfile.set(telegramProfile) 
    
    let sharedProfile = new SharedProfileRepository(this.agent, communityDID)
    let exists = await sharedProfile.isInitialised()
    if (exists) {
      return await this.updateTelegramInfoInSocials(sharedProfile, profileSchema, telegramProfile)
    } else {
      return this.set(telegramProfile)
    }
  }

  async updateTelegramInfoInSocials(sharedProfile, profileSchema, telegramProfile) {
    let sharedProfileData = await sharedProfile.get()
    
    //find telegram in socials and update it
    const telegramIndex = sharedProfileData.socials.findIndex(social => social.prodid === "telegram");

    if (telegramIndex != -1) {
      sharedProfileData.socials[telegramIndex] = {
        ...sharedProfileData.socials[telegramIndex],
        prodid: "telegram",
        id: telegramProfile.id,
        first_name: telegramProfile.first_name,
        last_name: telegramProfile.last_name,
        username: telegramProfile.username,
        photo_url: telegramProfile.photo_url,
        auth_date: telegramProfile.auth_date,
        hash: telegramProfile.hash
      };
    } else {
      sharedProfileData.socials.push({
        prodid: "telegram",
        id: telegramProfile.id,
        first_name: telegramProfile.first_name,
        last_name: telegramProfile.last_name,
        username: telegramProfile.username,
        photo_url: telegramProfile.photo_url,
        auth_date: telegramProfile.auth_date,
        hash: telegramProfile.hash
      });
    }

    const communityProfile = {
      "inputs": sharedProfileData.inputs,
      "socials": sharedProfileData.socials,
      "version": sharedProfileData.version
    }

    await sharedProfile.set(communityProfile, profileSchema)
    console.log("Profile after save :", communityProfile)
  }

  async updateCommunityProfile(communityDID, profileSchema, inputs) {
    let sharedProfile = new SharedProfileRepository(this.agent, communityDID)
    let exists = await sharedProfile.isInitialised()
    if (exists) {
      return await this.createCommunityProfile(communityDID, profileSchema, inputs)
    } else {
      return await this.set(inputs)
    }
  }

  async createCommunityProfile(communityDID, profileSchema, inputs) {
    let profile = await this.get()
    let sharedProfile = new SharedProfileRepository(this.agent, communityDID)

    const communityProfile = {
      "inputs": inputs,
      "socials": [
        {
          "prodid": "farcaster",
          "fid": profile.fid,
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

  async contactForHandshake(approverDID) {
    let accountDID = await this.agent.accountDID()
    let profile = await this.get()
    let xml

    let sharedProfile = new SharedProfileRepository(this.agent, approverDID)
    let exists = await sharedProfile.isInitialised()
    if (exists) {
      let accessKey = await this.agent.getAccessKeyForPrivateFile(sharedProfile.filename)
      let encodedAccessKey = uint8arrays.toString(accessKey.toBytes(), 'base64url');    
      xml = `${sharedProfile.filename}:${encodedAccessKey}`
    } else {
      let profileAccessKey = await this.agent.getAccessKeyForPrivateFile(this.filename)
      let encodedProfileAccessKey = uint8arrays.toString(profileAccessKey.toBytes(), 'base64');
      xml = `profile.json:${encodedProfileAccessKey}`
    }
  
    return {
      FN: profile.name,
      UID: `DCN:${accountDID}`,
      PRODID: "DCN:rolodex",
      XML: xml
    }
  }
}