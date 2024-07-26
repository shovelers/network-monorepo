interface ProfileData {
  inputs: object
  version: number
  socials: Array<object>
}

export class Profile {
  inputs: object
  version: number
  socials: Array<object>

  constructor(fields: ProfileData) {
    this.inputs = fields.inputs
    this.version = fields.version
    this.socials = fields.socials
  }

  static createFromOldProfileJson(profile: any): Profile {
    return new Profile({
      inputs: profile,
      version: 1,
      socials: [
        {
          prodid: "farcaster", fid: "",
          pfpUrl: profile.pfpUrl,
          username: profile.handle,
          displayName: profile.name,
          bio: profile.text
        }
      ]
    })
  }
}