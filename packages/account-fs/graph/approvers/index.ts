import { Person } from "../repository/people/person";

export class CommunityHandshakeApprover {
  private repositories: any;
  private agent: any;

  constructor(repositories: any, agent: any) {
    this.repositories = repositories
    this.agent = agent
  }

  async handleChallenge(challengeEvent) {
    console.log("receieved from requester :", challengeEvent.detail)
    const communityDID = await this.agent.accountDID()
    const contact = await this.repositories.members.contactForHandshake()
    let person = new Person(challengeEvent.detail.message.challenge.person)
    let valid = await person.validateProfileForCommunity(this.agent, this.repositories.community.sample(communityDID).profileSchema, challengeEvent.detail.message.challenge.head)
    console.log("sending a valid profile? ", valid, challengeEvent.detail.message.challenge.person)
    if (valid) {
      await this.repositories.members.add(challengeEvent.detail.message.challenge.person)
      await challengeEvent.detail.confirm({person: contact}) 
    } else {
      await challengeEvent.detail.reject()  
    }
  }
}

export class AppHandshakeApprover {
  private repositories: any;

  constructor(repositories: any) {
    this.repositories = repositories
  }

  async handleChallenge(challengeEvent) {
    console.log("receieved from requester :", challengeEvent.detail)
    let person = challengeEvent.detail.message.challenge.person
    let result = await this.repositories.people.create(new Person(person))
    console.log("person added to contacts :", result)
  
    let self = await this.repositories.profile.contactForHandshake()
    self.FN = "Rolodex"
    self.CATEGORIES = "app"
    console.log("Person with XML :", self)
    // TODO Implementing auto-confim - check challenge to implement reject
    await challengeEvent.detail.confirm({person: self})
  }
}

export class PeopleHandshakeApprover {
  private repositories: any;

  constructor(repositories: any) {
    this.repositories = repositories
  }

  async handleChallenge(challengeEvent) {
    console.log(challengeEvent.detail)
    let person = challengeEvent.detail.message.challenge.person
    let result = await this.repositories.people.create(new Person(person))
    console.log("person added to contacts :", result)

    let self = await this.repositories.profile.contactForHandshake()
    console.log("Person with XML :", self)
    // TODO Implementing auto-confim - check challenge to implement reject
    await challengeEvent.detail.confirm({person: self})
  }
}