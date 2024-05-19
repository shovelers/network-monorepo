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
}