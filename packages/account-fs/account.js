import { PeopleRepository } from "./repository/people/people.ts";
import { PeopleSearch } from "./repository/people/search.js";
import { Person } from "./repository/people/person.ts";
import { ProfileRepository } from "./repository/profiles/profiles.js";
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
    this.brokerDID = null
  }

  setBrokerDID(brokerDID) {
    this.brokerDID = brokerDID
  }

  start(){
    this.router = {
      requester: {
        "JOIN": { channel: "DIRECT", controller: "TBD", suffix: "membership" },
        "RELATE": { channel: "BROKERED", controller: "TBD", suffix: "relationship" }
      },
      approver: {
        "RELATE": { channel: "BROKERED", controller: "TBD", suffix: "relationship" }
      },
      broker: false
    }
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

  async requestHandshake(accountDID, brokerDID = null) {
    let person = await this.repositories.profile.contactForHandshake(accountDID)
    console.log("person with XML :", person)

    let requester
    if (brokerDID) {
      let status = await this.agent.establishConnection(brokerDID)
      console.log("inbox:", accountDID, status)
      requester = await this.agent.actAsRelationshipRequester(brokerDID, accountDID)
    } else {
      let status = await this.agent.establishConnection(accountDID)
      console.log("inbox:", accountDID, status)
      requester = await this.agent.actAsJoinRequester(accountDID)
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

    setTimeout(() => { requester.initiate() }, 5)

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

    let status = await this.agent.establishConnection(brokerDID)
    console.log("inbox:", accountDID, brokerDID, status)

    await this.agent.actAsRelationshipApprover(brokerDID, accountDID)

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

  async getProfile(communityDID = null){
    return await this.repositories.profile.get(communityDID)
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