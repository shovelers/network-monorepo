import * as uint8arrays from 'uint8arrays';

const PRODIDs = {
  "APPLE": "APPLE",
  "GOOGLE": "GOOGLE",
  "DCN": "DCN"
}

/*
  "PRODID": "GOOGLE",
  "UID": contact.resourceName,

  "PRODID": "DCN",
  "UID": `DCN:${contact.handle}`, || `DCN:${contact.fullname}` 

  "PRODID": "FARCASTER",
  "UID": `FARCASTER:${contact.fid}`, || `DCN:${contact.handle}` 

  "PRODID": "APPLE",
  "UID": contact.UID,
*/

export class Person {
  PRODID;
  UID;
  FN;
  CATEGORIES;
  URL;
  NOTE;
  TEL;
  EMAIL;
  // TODO: Define how to use XML for profile
  XML;

  constructor(fields) {
    this.PRODID = fields.PRODID  //required
    this.UID = fields.UID        //required
    this.FN = fields.FN          //required
    this.CATEGORIES = fields.CATEGORIES || ""
    this.URL = fields.URL || ""
    this.NOTE = fields.NOTE || ""
    this.TEL = fields.TEL
    this.EMAIL = fields.EMAIL
    this.XML = fields.XML
    this.VERSION = "4.0"
  }

  asJSON() {
    return {
      PRODID: this.PRODID,
      UID: this.UID,
      TEL: this.TEL,
      EMAIL: this.EMAIL,
      FN: this.FN,
      CATEGORIES: this.CATEGORIES,
      URL: this.URL,
      NOTE: this.NOTE,
      XML: this.XML
    }
  }
}

export class MembersRepository {
  constructor(agent) {
    this.agent = agent
    this.filename = "members.json" 
  }

  async isInitialised() {
    return await this.agent.fileExists(this.filename) 
  }

  async initialise(){
    const exists = await this.agent.fileExists(this.filename)
    if (!exists) {
      console.log("I am here")
      await this.agent.updatePrivateFile(this.filename, () => { return { memberList: {}} })
    }
  }

  async list() {
    try {
      const content = await this.agent.readPrivateFile(this.filename);
      const members = [];

      for (const [_, member] of Object.entries(content.memberList)) {
        members.push(
          new Person({
            PRODID: member.PRODID,
            UID: member.UID,
            TEL: member.TEL,
            EMAIL: member.EMAIL,
            FN: member.FN,
            //TODO: remove below fields from search results, when searched from other apps
            CATEGORIES: member.CATEGORIES,
            URL: member.URL,
            NOTE: member.NOTE,
            XML: member.XML,
          })
        );
      }

      return members;
    } catch (error) {
      console.log(error)  
    }
  }

  async add(member){
    await this.agent.updatePrivateFile(this.filename, (content) => {
      content.memberList[member.UID] = member;
      return content;
    });
  }

  async contactForHandshake() {
    let memberDirectoryAccessKey = await this.agent.getAccessKeyForPrivateFile('members.json')
    let encodedMemberDirectoryAccessKey = uint8arrays.toString(memberDirectoryAccessKey.toBytes(), 'base64url');
    
    // let profile = await this.get()
    let handle = await this.agent.handle() 
    let profileAccessKey = await this.agent.getAccessKeyForPrivateFile('profile.json')
    let encodedProfileAccessKey = uint8arrays.toString(profileAccessKey.toBytes(), 'base64');

    console.log("preparing community info to be shared in join handshake...")
 
    return {
      FN: await this.agent.handle(),
      UID: `DCN:${await this.agent.accountDID()}`,
      PRODID: "DCN:rolodex",
      CATEGORIES: 'community',
      XML: `profile.json:${handle}.${encodedProfileAccessKey}|members.json:${handle}.${encodedMemberDirectoryAccessKey}`
    }
  }
}