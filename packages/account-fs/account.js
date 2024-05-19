import { PeopleRepository } from "./repository/people/people.ts";
import { ProfileRepository } from "./repository/profile/profile.js";
import * as uint8arrays from 'uint8arrays';

//represents account on the network in the context of an application running account-fs
//  applicationDID to be used as the application context
//  `create` calls Hub with applicationDID & `signed payload` from applicationDID 
//   to creates root fs, and get accessKey for the subfolder back & UCAN for forestCID edit// need to be implemented on Hub's Account Service
export class AccountV1 {
  constructor(agent, additionalRepos) {
    this.agent = agent
    this.repositories = { profile: new ProfileRepository(agent) }
    if (additionalRepos.includes("PEOPLE")) {
      this.repositories.people = new PeopleRepository(agent)
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
}