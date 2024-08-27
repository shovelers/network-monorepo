import { Person } from "../repository/people/person";

export class CommunityHandshakeApprover {
  private repositories: any;
  private agent: any;

  constructor(repositories: any, agent: any) {
    this.repositories = repositories
    this.agent = agent
  }

  async challenge(handshake){
    const communityDID = await this.agent.accountDID()
    const communityFile = this.repositories.community.sample(communityDID)
    await handshake.challenge({challenge: communityFile})
  }

  async approve(handshake){
    const challenge = await handshake.challengeSubmission()
    console.log("challenge received:", challenge)
    const communityDID = await this.agent.accountDID()
    const contact = await this.repositories.members.contactForHandshake()
    let person = new Person(challenge.person)
    let valid = await person.validateProfileForCommunity(this.agent, this.repositories.community.sample(communityDID).profileSchema, challenge.head)
    console.log("sending a valid profile? ", valid, challenge.person)
    if (valid) {
      await this.repositories.members.add(challenge.person)
      await handshake.confirm({person: contact}) 
    } else {
      await handshake.reject()  
    }
  }
}

export class AppHandshakeApprover {
  private repositories: any;

  constructor(repositories: any) {
    this.repositories = repositories
  }

  async challenge(handshake){
    await handshake.challenge({})
  }

  async approve(handshake){
    const challenge = await handshake.challengeSubmission()
    console.log("challenge received:", challenge)

    let result = await this.repositories.people.create(new Person(challenge.person))
    console.log("person added to contacts :", result)
  
    let self = await this.repositories.profile.contactForHandshake()
    // TODO remove hardcoding for rolodex
    self.FN = "Rolodex"
    self.CATEGORIES = "app"
    console.log("Person with XML :", self)
    // TODO Implementing auto-confim - check challenge to implement reject
    await handshake.confirm({person: self})
  }
}

export class PeopleHandshakeApprover {
  private repositories: any;

  constructor(repositories: any) {
    this.repositories = repositories
  }

  async challenge(handshake){
    await handshake.challenge({})
  }

  async approve(handshake){
    console.log("challenge received:", await handshake.challengeSubmission())
  }

  async confirm(handshake){
    let challenge = await handshake.challengeSubmission()
    console.log("challenge submission", challenge)

    let result = await this.repositories.people.create(new Person(challenge.person))
    console.log("person added to contacts :", result)

    let self = await this.repositories.profile.contactForHandshake()
    console.log("Person with XML :", self)
    await handshake.confirm({person: self}) 
  }

  async reject(handshake){
    await handshake.reject()
  }
}