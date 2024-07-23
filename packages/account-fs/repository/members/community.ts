import * as uint8arrays from 'uint8arrays';
import { PersonData } from '../people/person';

export class CommunityRepository {
  private agent: any;
  private filename: string = "community.json";

  constructor(agent: any) {
    this.agent = agent;
  }

  async isInitialised(): Promise<Boolean> {
    return await this.agent.fileExists(this.filename) 
  }

  async initialise(): Promise<void> {}

  // VCard style fields with Avro style schemas
  sample(): any {
    return {
      FN: "Creole",
      schemas: [
        {
          type: "record",
          name: "farcasterProfile",
          fields: [
            { name: "fid", type: "string" },
            { name: "username", type: "string" },
            { name: "bio", type: "string" },
            { name: "displayName", type: "string" },
            { name: "pfpUrl", type: "string" },
          ]
        },
        {
          type: "enum",
          name: "lookingForOptions",
          symbols: ["Gigs", "Job", "Partnerships", "Talent", "Warm Intros"]
        },
        {
          type: "enum",
          name: "canHelpWithOptions",
          symbols: ["Development", "Tokenomics", "Design", "Ideation", "Job/Gig Opportunities", "GTM", "Testing", "Mentorship", "Fundraise", "Introductions"],
        },
        {
          type: "enum",
          name: "expertiseOptions",
          symbols: ["Frames", "Full Stack", "Backend", "Frontend", "Design", "Data Analysis", "Smart Contracts", "Community", "Consumer Tech", "Social"]
        },
        {
          type: "record",
          name: "profile",
          fields: [
            { name: "socials", type: { type: "map", values: ["farcasterProfile"] } },
            { name: "files", type: { type: "array", items: "string" } },
            { name: "lookingFor", type: { type: "array", items: "lookingForOptions" } },
            { name: "canHelpWith", type: { type: "array", items: "canHelpWithOptions" } },
            { name: "expertise", type: { type: "array", items: "expertiseOptions" } }
          ]
        }
      ]
    };
  }

  async upsert(data: any): Promise<void> {
    await this.agent.updatePrivateFile(this.filename, () => data);
  }

  async get(): Promise<any> {
    return await this.agent.readPrivateFile(this.filename)
  }

  async contactForHandshake(): Promise<PersonData> {
    let memberDirectoryAccessKey = await this.agent.getAccessKeyForPrivateFile('members.json')
    let encodedMemberDirectoryAccessKey = uint8arrays.toString(memberDirectoryAccessKey.toBytes(), 'base64url');
    
    let community = await this.get()
    let communityAccessKey = await this.agent.getAccessKeyForPrivateFile(this.filename)
    let encodedCommunityAccessKey = uint8arrays.toString(communityAccessKey.toBytes(), 'base64url');

    return {
      FN: community.FN,
      UID: `DCN:${await this.agent.accountDID()}`,
      PRODID: "DCN:rolodex",
      CATEGORIES: 'community',
      XML: `${this.filename}:handle.${encodedCommunityAccessKey}|members.json:handle.${encodedMemberDirectoryAccessKey}`
    }
  }
}

// exchange file on handshake
// user's profile based on community schema
  // render user profile
// render join form
// render directory table
// search matchers to use schema fields