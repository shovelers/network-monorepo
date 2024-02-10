import { PrivateFS } from "./private_fs.js"

export class AccountFS {
  constructor(helia, agent, appHandle){
    this.helia = helia
    this.agent = agent
    this.fs = new PrivateFS(helia, appHandle)
  }

  async load(){
    try {
      let accessKey = await this.agent.accessKey()
      let forestCID = await this.agent.forestCID()

      if (accessKey && forestCID){
        await this.fs.loadForest(accessKey, forestCID)
      }
    } catch (err) {
      console.log("missing datastore keys, need an account")
      return 
    }
  }

  async readPrivateFile(filename) {
    try {
      let content = await this.fs.read(filename)
      return JSON.parse(content)
    } catch (error) {
      console.log("missing file: ", filename)
    }
  }

  async getAccessKeyForPrivateFile(filename) {
    let forestCID = await this.agent.forestCID()
    let accessKey = await this.fs.accessKeyForPrivateFile(filename)
    return [accessKey, forestCID]
  }

  async updatePrivateFile(filename, mutationFunction) {
    let content = await this.readPrivateFile(filename)
    let newContent = mutationFunction(content)
    var [access_key, forest_cid] = await this.fs.write(filename, JSON.stringify(newContent))

    await this.agent.pin(access_key,forest_cid)
    return newContent
  }
}