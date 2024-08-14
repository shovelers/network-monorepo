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
  sample(communityDID): any {
    var communityFile: any = {
      FN: "Creole",
      profileSchema: {
        "type": "object",
        "required": ["inputs", "version", "socials"],
        "properties": {
          "inputs": {
            "type": "object",
            "properties": {
              "lookingFor": {
                "title": "Looking For",
                "type": "array",
                "uniqueItems": true,
                "items": {
                  "type": "string",
                  "enum": ["Gigs", "Job", "Partnerships", "Talent", "Warm Intros"]
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
                  "enum": ["Frames", "Full Stack", "Backend", "Frontend", "Design", "Data Analysis", "Smart Contracts", "Community", "Consumer Tech", "Social"]
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
                    "fid": { "type": "string" },
                    "displayName": { "type": "string" },
                    "username": { "type": "string" },
                    "bio": { "type": "string" },
                    "pfpUrl": { "type": "string" }
                  }
                },
                {
                  "type": "object",
                  "$id": "linkedIn",
                  "properties": {
                    "prodid": { "type": "string" },
                    "school": { "type": "string" } 
                  }
                },
                {
                  "type": "object",
                  "$id": "telegram",
                  "properties": {
                    "prodid": { "type": "string" },
                    "id":{ "type": "string" },
                    "first_name":{ "type": "string" },
                    "last_name": { "type": "string" },
                    "username": { "type": "string" },
                    "photo_url": { "type": "string" },
                    "auth_date": { "type": "string" },
                    "hash": { "type": "string" }
                  } 
                }
              ]
            }
          },
          "version": { "type": "number" }
        }
      }
    };

    if (communityDID == "did:pkh:eip155:8453:0xf5a4c46FE6Cd432bb41C10827C31D32c7Ef30aC4") {
      communityFile.FN = "TokyoDAO"
      communityFile.profileSchema.properties.inputs.properties = {
        "location": {
          "title": "Location",
          "type": "array",
          "uniqueItems": true,
          "items": {
            "type": "string",
            "enum": [
              "Japan", "North America", "Europe", "South America", "Africa", "Australia",
              "India", "China", "South Korea", "Hong Kong", "Taiwan", "Malaysia", "Indonesia",
              "Thailand", "Singapore", "Philippines", "Other Asia", "Middle East"
            ]
          }
        },
        "expertise": {
          "title": "Expertise",
          "type": "array",
          "uniqueItems": true,
          "items": {
            "type": "string",
            "enum": ["Design", "Community Building", "Strategy", "Tokenomics", "Engineering", "Fundraising", "Admin/Operations", "GTM"]
          },
        },
        "lookingFor": {
          "title": "Looking For",
          "type": "array",
          "uniqueItems": true,
          "items": {
            "type": "string",
            "enum": ["Events (Online)", "Events (Offline)", "Hiring Talent", "Friendly Builders", "Capital", "Japan GTM Support", "Global GTM Support", "Partnerships", "New Friends"]
          }
        }
      }
    }

    if (communityDID == "did:pkh:eip155:8453:0x1Dbc304222E62771eB9AbBA6d5Aa495C195644be") {
      communityFile.FN = "DecentralisedCo"
      communityFile.profileSchema.properties.inputs.properties = {
        "lookingFor": {
          "title": "Looking For",
          "type": "array",
          "uniqueItems": true,
          "items": {
            "type": "string",
            "enum": ["Gigs", "Job", "Partnerships", "Talent", "Warm Intros", "Fundraise", "Founders"]
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
            "enum": ["Data Science", "Market Research", "DeFi", "Design", "Community Building", "Strategy", "Economics", "Engineering", "Fundraising", "Admin/Operations"]
          },
        },
      }
    }

    if (communityDID == "did:pkh:eip155:8453:0x87c64C159E90A9414614Eb2E44f413E41317e416") {
      communityFile.FN = "TheSuccessSyndicate"
      communityFile.profileSchema.properties.inputs.properties = {
        "location": {
          "title": "Location",
          "type": "array",
          "uniqueItems": true,
          "items": {
            "type": "string",
            "enum": [
              "USA/Canada", "Brazil/Argentina", "UK", "Japan", "Nigeria", "Australia/NZ", "India", "China", "South Korea",
              "Taiwan", "Singapore", "South East Asia", "Middle East", "Other NA", "Other SA", "Other Europe", "Other Africa", "Other Asia"
            ]
          }
        },
        "expertise": {
          "title": "Expertise",
          "type": "array",
          "uniqueItems": true,
          "items": {
            "type": "string",
            "enum": [
              "Design", "Community Building", "Strategy", "Tokenomics", "Engineering", "Fundraising", "Admin/Operations", "GTM", "Founder", 
              "Investor", "Product", "Building", "Selling", "Marketing"
            ]
          },
        },
        "lookingFor": {
          "title": "Looking For",
          "type": "array",
          "uniqueItems": true,
          "items": {
            "type": "string",
            "enum": [
              "Events (Online)", "Events (Offline)", "Hiring Talent", "Friendly Builders", "Capital", "Jobs/Gigs", "New Friends", "Partnerships"
            ]
          }
        }
      }
    }

    if (communityDID == "did:pkh:eip155:8453:0x8152124614EF975adD93349a57aDbB563333d77c") {
      communityFile.FN = "TerminallyOnchain"
      communityFile.profileSchema.properties.inputs.properties = {
        "lookingFor": {
          "title": "Looking For",
          "type": "array",
          "uniqueItems": true,
          "items": {
            "type": "string",
            "enum": ["Crypto Discussions", "New Friends", "NFT Projects", "Gigs", "Job", "Partnerships", "Talent", "Warm Intros", "Fundraise", "Founders"]
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
            "enum": ["Data Science", "Market Research", "DeFi", "Design", "Community Building", "Strategy", "Economics", "Engineering", "Fundraising", "Admin/Operations"]
          },
        },
      }
    }

    if (communityDID == "did:pkh:eip155:8453:0x68a976F97F1dec621BdAC78Fc931268EB50777a4") {
      communityFile.FN = "Rebase"
      communityFile.profileSchema.properties.inputs.properties = {
        "location": {
          "title": "Location",
          "type": "array",
          "uniqueItems": true,
          "items": {
            "type": "string",
            "enum": [
              "USA/Canada", "Brazil/Argentina", "UK", "Japan", "Nigeria", "Australia/NZ", "India", "China", "South Korea",
              "Taiwan", "Singapore", "South East Asia", "Middle East", "Other NA", "Other SA", "Other Europe", "Other Africa", "Other Asia"
            ]
          }
        },
        "expertise": {
          "title": "Expertise",
          "type": "array",
          "uniqueItems": true,
          "items": {
            "type": "string",
            "enum": [
              "Design", "Community Building", "Strategy", "Tokenomics", "Engineering", "Fundraising", "Admin/Operations", "GTM", "Founder", 
              "Investor", "Product", "Building", "Selling", "Marketing"
            ]
          },
        },
        "lookingFor": {
          "title": "Looking For",
          "type": "array",
          "uniqueItems": true,
          "items": {
            "type": "string",
            "enum": [
              "Events (Online)", "Events (Offline)", "Hiring Talent", "Friendly Builders", "Capital", "Jobs/Gigs", "New Friends", "Partnerships"
            ]
          }
        }
      }
    }

    if (communityDID == "did:pkh:eip155:8453:0xBEb2f178d748f233f315578f4Cc4D3CfA95A0bb1") {
      communityFile.FN = "ProxyStudio"
      communityFile.profileSchema.properties.inputs.properties = {
        "roles": {
          "title": "Roles",
          "type": "array",
          "uniqueItems": true,
          "items": {
            "type": "string",
            "enum": [
              "Founder", "Product", "Designer", "Developer", "Freelancer", "Investor", "Artist", "Manager", "Writer"
            ]
          }
        },
        "expertise": {
          "title": "Expertise",
          "type": "array",
          "uniqueItems": true,
          "items": {
            "type": "string",
            "enum": [
              "Product", "Engineering", "Finance", "Community Building", "Tokenomics", "Economics", "Fundraising", "Farcaster Development", "Marketing",
              "Research", "Strategy", "Web and Mobile Design", "Project Management", "Operations / Admin", "Deep Technical", "Sales and Partnerships",
              "Communication and storytelling"
            ]
          },
        },
        "location": {
          "title": "Location",
          "type": "array",
          "uniqueItems": true,
          "items": {
            "type": "string",
            "enum": [
              "USA/Canada", "Brazil/Argentina", "UK", "Japan", "Nigeria", "Australia/NZ", "India", "China", "South Korea",
              "Taiwan", "Singapore", "South East Asia", "Middle East", "Other NA", "Other SA", "Other Europe", "Other Africa", "Other Asia"
            ]
          }
        }
      }
    }

    return communityFile
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