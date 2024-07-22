import * as uint8arrays from 'uint8arrays';
// import { Person } from "./../people/person";

//TODO fix TS import in js server
class Person {
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
    const content = await this.agent.readPrivateFile(this.filename);
    const members = [];

    for (const [_, member] of Object.entries(content.memberList)) {
      members.push(new Person(member));
    }

    return members;
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