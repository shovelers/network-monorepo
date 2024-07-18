import { PeopleRepository } from "./repository/people/people.ts";
import { Person } from "./repository/people/person.ts";
import { ProfileRepository } from "./repository/profile/profile.js";

//represents account on the network in the context of an application running account-fs
//  applicationDID to be used as the application context
//  `create` calls Hub with applicationDID & `signed payload` from applicationDID 
//   to creates root fs, and get accessKey for the subfolder back & UCAN for forestCID edit// need to be implemented on Hub's Account Service
export class AccountV1 {
  constructor(agent) {
    this.agent = agent
    this.repositories = {
      profile: new ProfileRepository(agent),
      people: new PeopleRepository(agent)
    }
  } 

  async create(accountDID, siweMessage, siweSignature) {
    // TODO review failure scenarios of register
    const success = await this.agent.register(accountDID, siweMessage, siweSignature)

    if (success.status) {
      if (success.created) {
        const accessKey = await this.agent.fs.initialise()
        await this.agent.setCustodyKey(accessKey)
      } else {
        await this.agent.load()
      }

      for (const [key, value] of Object.entries(this.repositories)) {
        await value.initialise()
      }
    }
    return success
  }

  // recovery - not needed for facaster login

  async requestHandshake(accountDID) {
    let person = await this.repositories.profile.contactForHandshake()
    console.log("person with XML :", person)

    let address = await this.agent.getInbox(accountDID)
    console.log("inbox:", accountDID, address)

    let requester = await this.agent.actAsJoinRequester(address, accountDID)
    requester.challenge = function () { return { person: person } }

    requester.notification.addEventListener("CONFIRMED", async (event) => {
      let community = event.detail.data.community
      let result = await this.repositories.people.create(new Person({FN: community.FN, PRODID: community.PRODID, UID: community.UID, XML: community.XML, CATEGORIES: 'community'}))
      console.log("community added to contacts :", result)
    })

    await requester.initiate()
  }

  async getProfile(){
    return await this.repositories.profile.get()
  }

  async editProfile(params){
    return await this.repositories.profile.set(params)
  }

  async signout(){
    await this.agent.destroy()
  }

  async activeSession() {
    return this.agent.activeSession()
  }
}