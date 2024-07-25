import { PeopleRepository } from "./repository/people/people.ts";
import { PeopleSearch } from "./repository/people/search.js";
import { Person } from "./repository/people/person.ts";
import { ProfileRepository } from "./repository/profile/profile.js";
import { MembersRepository } from "./repository/members/members.js";
import { CommunityRepository } from "./repository/members/community.ts";

export class AccountV1 {
  constructor(agent) {
    this.agent = agent
    this.repositories = {
      profile: new ProfileRepository(agent),
      people: new PeopleRepository(agent)
    }
    this.ps = new PeopleSearch(agent, this.repositories.people)
  } 

  async loadRepositories(){
    let members = new MembersRepository(this.agent)
    if (await members.isInitialised()){
      this.repositories.members = members
      this.repositories.community = new CommunityRepository(this.agent)
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

  async requestHandshake(accountDID, brokerDID = null) {
    let person = await this.repositories.profile.contactForHandshake(accountDID)
    console.log("person with XML :", person)

    let requester
    if (brokerDID) {
      let address = await this.agent.getInbox(brokerDID)
      console.log("inbox:", accountDID, address)
      requester = await window.shovel.agent.actAsRelationshipRequester(address, brokerDID, accountDID)
    } else {
      let address = await this.agent.getInbox(accountDID)
      console.log("inbox:", accountDID, address)
      requester = await this.agent.actAsJoinRequester(address, accountDID)
    }
    
    const head = await this.agent.head()
    requester.challenge = function () { return { person: person, head: head } }

    let handshakeSuccess = false
    let shouldWeWait = true
    requester.notification.addEventListener("CONFIRMED", async (event) => {
      let person = event.detail.data.person
      let result = await this.repositories.people.create(new Person(person))
      console.log("community added to contacts :", result)
      shouldWeWait = false
      handshakeSuccess = true
    })

    requester.notification.addEventListener("REJECTED", async (event) => {
      shouldWeWait = false
    })

    await requester.initiate()

    await new Promise((resolve) => {
      const checkFlag = () => {
        if (!shouldWeWait) {
          resolve();
        } else {
          setTimeout(checkFlag, 100); // Check every 100ms
        }
      };
      checkFlag();
    });

    return handshakeSuccess
  }

  async handshakeApprover(brokerDID) {
    var accountDID = await this.agent.accountDID()

    let address = await this.agent.getInbox(brokerDID)
    console.log("inbox:", accountDID, brokerDID, address)

    await this.agent.actAsRelationshipApprover(address, brokerDID, accountDID)

    this.agent.approver.notification.addEventListener("challengeRecieved", async (challengeEvent) => {
      console.log(challengeEvent.detail)
      let person = challengeEvent.detail.message.challenge.person
      let result = await this.repositories.people.create(new Person(person))
      console.log("person added to contacts :", result)

      let self = await this.repositories.profile.contactForHandshake()
      console.log("Person with XML :", self)
      // TODO Implementing auto-confim - check challenge to implement reject
      await challengeEvent.detail.confirm({person: self})
    })
  }

  async search(params) {
    return await this.ps.search(params)
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