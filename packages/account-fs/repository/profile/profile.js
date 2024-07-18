import * as uint8arrays from 'uint8arrays';

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