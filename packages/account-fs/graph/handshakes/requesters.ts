import { Person } from "../repository/people/person";

export class HandshakeRequester {
  private repositories: any;
  private agent: any;
  private requester: any;
  private accountDID: string;

  constructor(repositories: any, agent: any, requester: any, accountDID: string) {
    this.repositories = repositories;
    this.agent = agent;
    this.requester = requester;
    this.accountDID = accountDID;
  }

  async requestChallenge(): Promise<{ challenge: any; submit: () => Promise<boolean> }> {
    let challenge: any;
    let submit: (data: any) => Promise<void>;
    let shouldWeWait = true;

    this.requester.notification.addEventListener("challengeIntiated", async (event: CustomEvent) => {
      console.log("Challenge received:", event.detail.challenge);
      challenge = event.detail.challenge;
      submit = event.detail.submit;
      shouldWeWait = false;
    });

    await this.requester.initiate();

    await new Promise<void>((resolve) => {
      const checkFlag = () => {
        if (!shouldWeWait) {
          resolve();
        } else {
          setTimeout(checkFlag, 10); // Check every 10ms
        }
      };
      checkFlag();
    });

    return { challenge, submit: this.createSubmitWrapper(submit) };
  }

  private createSubmitWrapper(submit: (data: any) => Promise<void>): () => Promise<boolean> {
    const context = this;
    return async function(): Promise<boolean> {
      let handshakeSuccess = false;
      let shouldWeWait = true;

      const person = await context.repositories.profile.contactForHandshake(context.accountDID);
      console.log("person with XML :", person);

      const head = await context.agent.head();
      const submissionData = { person, head };

      context.requester.notification.addEventListener("CONFIRMED", async (event: CustomEvent) => {
        const person = event.detail.data.person;
        const result = await context.repositories.people.create(new Person(person));
        console.log("community added to contacts :", result);
        shouldWeWait = false;
        handshakeSuccess = true;
      });

      context.requester.notification.addEventListener("REJECTED", async () => {
        shouldWeWait = false;
      });

      await submit(submissionData);

      await new Promise<void>((resolve) => {
        const checkFlag = () => {
          if (!shouldWeWait) {
            resolve();
          } else {
            setTimeout(checkFlag, 10); // Check every 10ms
          }
        };
        checkFlag();
      });

      return handshakeSuccess;
    };
  }
}