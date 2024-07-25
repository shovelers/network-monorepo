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

  // VCard style fields with JSON schemas for Profile
  sample(): any {
    return {
      FN: "Creole",
      profileSchema: {
        "type": "object",
        "required": ["inferred", "input", "version", "socials"],
        "properties": {
          "inferred": {
            "type": "object",
            "properties": {
              "name": { "type": "string"},
              "handle": { "type": "string"},
              "bio": {"type": "string"},
              "school": {"type": "string"},
            }
          },
          "inputs": {
            "type": "object",
            "properties": {
              "lookingFor": {
                "title": "Looking For",
                "type": "array",
                "uniqueItems": true,
                "items": {
                  "type": "string",
                  "enum": ["Development", "Tokenomics", "Design", "Ideation", "Job/Gig Opportunities", "GTM", "Testing", "Mentorship", "Fundraise", "Introductions"]
                }
              },
              "canHelpWith": {
                "title": "Can Help With",
                "type": "array",
                "uniqueItems": true,
                "items": {
                  "type": "string",
                  "enum": ["Development", "Tokenomics", "Design", "Ideation", "Job/Gig Opportunities", "GTM", "Testing", "Mentorship", "Fundraise", "Introductions"]
                }
              },
              "expertise": {
                "title": "Expertise",
                "type": "array",
                "uniqueItems": true,
                "items": {
                  "type": "string",
                  "enum": ["Development", "Tokenomics", "Design", "Ideation", "Job/Gig Opportunities", "GTM", "Testing", "Mentorship", "Fundraise", "Introductions"]
                }
              }
            }
          },
          "socials": {
            "type": "array",
            "uniqueItems": true,
            "items": {
              "anyOf": [
                {
                  "type": "object",
                  "$id": "farcaster",
                  "properties": {
                    "prodid": { "type": "string" },
                    "name": { "type": "string" },
                    "handle": { "type": "string" },
                    "bio": { "type": "string" }
                  }
                },
                {
                  "type": "object",
                  "$id": "LinkedIn",
                  "properties": {
                    "prodid": { "type": "string" },
                    "school": { "type": "string" } 
                  }
                }
              ]
            }
          },
          "version": { "type": "number" }
        }
      }
    };
  }

  /*
  -- uid-profile.json (content)
  {
    "name": socials.farcaster.name
    "handle": socials.farcaster.handle
    "bio": socials.farcaster.bio
    "school": socials.linkedin.school
    "form": {
      "lookingFor": []
      "interestedIn": []
      "expertise": []
    }
    "socials": [
      {
        "$id": "farcaster"
        "name": ""
        "handle": ""
        "bio": ""
      },
      {
        "$id": "linkedIn"
        "school": ""
      }
    ]
    "version": int
  }
*/

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