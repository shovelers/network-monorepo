import { Person } from "../repository/people/person";

export class HandshakeRequester {
  private repositories: any;
  private agent: any;
  private requester: any;
  private accountDID: string;
  private eventTimeout: number;
  private challenge: any;

  constructor(repositories: any, agent: any, requester: any, accountDID: string) {
    this.repositories = repositories;
    this.agent = agent;
    this.requester = requester;
    this.accountDID = accountDID;
    this.eventTimeout = 20000 // 20 seconds
  }

  async requestChallenge(): Promise<{ challenge: any; submit: () => Promise<boolean> }> {
    let submit: (data: any) => Promise<void>;

    const challengePromise = new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error("Challenge initiation timed out")), this.eventTimeout)

      this.requester.notification.addEventListener("challengeIntiated", (event: CustomEvent) => {
        clearTimeout(timeoutId);
        console.log("Challenge received:", event.detail.challenge);
        this.challenge = event.detail.challenge;
        submit = event.detail.submit;
        resolve();
      }, { once: true });
    });
    
    await this.requester.initiate();

    try {
      await challengePromise;
    } catch (error) {
      console.error("Failed to receive challenge:", error);
      throw error;
    }

    return { challenge: this.challenge, submit: this.createSubmitWrapper(submit) };
  }

  private createSubmitWrapper(submit: (data: any) => Promise<void>): (params: any) => Promise<boolean> {
    const context = this;
    return async function(params: any): Promise<boolean> {
      // Hack for optional profile creation
      if (params) {
        console.log(params, context.challenge.challenge.profileSchema, context.challenge)
        await context.repositories.profile.createCommunityProfile(context.accountDID, context.challenge.challenge.profileSchema, params)
        // handle profile creation failure
      }

      let handshakeSuccess = false;
  
      const person = await context.repositories.profile.contactForHandshake(context.accountDID);
      const head = await context.agent.head();
      console.log("person with XML :", { person, head });
  
      await submit({ person, head });
  
      try {
        await new Promise<void>((resolve, reject) => {
          const timeoutId = setTimeout(() => reject(new Error("Handshake response timed out")), context.eventTimeout)
  
          context.requester.notification.addEventListener("CONFIRMED", async (event: CustomEvent) => {
            clearTimeout(timeoutId);
            const person = event.detail.data.person;
            const result = await context.repositories.people.create(new Person(person));
            console.log("community added to contacts :", result);
            handshakeSuccess = true;
            resolve();
          }, { once: true });
  
          context.requester.notification.addEventListener("REJECTED", () => {
            clearTimeout(timeoutId);
            resolve();
          }, { once: true });
        });
      } catch (error) {
        console.error("Handshake failed:", error);
      }
  
      return handshakeSuccess;
    };
  }
}