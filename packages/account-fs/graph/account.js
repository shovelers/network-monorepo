import { PeopleRepository } from "./repository/people/people.ts";
import { PeopleHandshakeApprover } from "./approvers/index.ts";
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

      if (this.brokerDID) {
        try {
          const { submit } = await this.requestChallenge(this.brokerDID)
          await submit()
          console.log(`Handhshake with broker: ${this.brokerDID} complete`)
        } catch (e) {
          console.log("Handshake Failed. Nuke. And Retry.", e)
          await this.agent.destroy()
          return false
        }
      }

      return true
    }
    return false
  }

  async requestChallenge(accountDID, brokerDID = null){
    let requester
    if (brokerDID) {
      let status = await this.agent.establishConnection(brokerDID)
      console.log("inbox:", accountDID, status)
      requester = await this.agent.requester.create(accountDID, "RELATE", brokerDID)
    } else {
      let status = await this.agent.establishConnection(accountDID)
      console.log("inbox:", accountDID, status)
      requester = await this.agent.requester.create(accountDID, "JOIN")
    }

    const request = new HandshakeRequester(this.repositories, this.agent, requester, accountDID)
    return await request.requestChallenge()
  }

  async handshakeApprover() {
    await this.agent.establishConnection(this.brokerDID)
    this.agent.approver.register("RELATE", new PeopleHandshakeApprover(this.repositories))
    this.agent.approver.start()
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

class HandshakeRequester {
  constructor(repositories, agent, requester, accountDID){
    this.repositories = repositories
    this.agent = agent
    this.requester = requester
    this.accountDID = accountDID
  }

  async requestChallenge() {
    let challenge, submit;
    let shouldWeWait = true
    this.requester.notification.addEventListener("challengeIntiated", async (event) => {
      console.log("Challenge received:", event.detail.challenge)
      challenge = event.detail.challenge
      submit = event.detail.submit
      shouldWeWait = false
    })

    await this.requester.initiate()

    await new Promise((resolve) => {
      const checkFlag = () => {
        if (!shouldWeWait) {
          resolve();
        } else {
          setTimeout(checkFlag, 10); // Check every 10ms
        }
      };
      checkFlag();
    });

    return { challenge, submit: this.createSubmitWrapper(submit) }
  }

  createSubmitWrapper(submit){
    let context = this
    return async function() {    
      let handshakeSuccess = false
      let shouldWeWait = true

      let person = await context.repositories.profile.contactForHandshake(context.accountDID)
      console.log("person with XML :", person)

      const head = await context.agent.head()
      const submissionData = { person, head }
  
      context.requester.notification.addEventListener("CONFIRMED", async (event) => {
        let person = event.detail.data.person
        let result = await context.repositories.people.create(new Person(person))
        console.log("community added to contacts :", result)
        shouldWeWait = false
        handshakeSuccess = true
      })
  
      context.requester.notification.addEventListener("REJECTED", async (event) => {
        shouldWeWait = false
      })
  
      await submit(submissionData)
  
      await new Promise((resolve) => {
        const checkFlag = () => {
          if (!shouldWeWait) {
            resolve();
          } else {
            setTimeout(checkFlag, 10); // Check every 10ms
          }
        };
        checkFlag();
      });
  
      return handshakeSuccess
    }
  }
}