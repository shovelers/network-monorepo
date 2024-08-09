import { TelegramProfile } from './telegram_profile'

class FarcasterProfile {
  prodid: string;
  fid: string;
  pfpUrl: string;
  username: string;
  displayName: string;
  bio: string;

  constructor(data: {
    prodid: string;
    fid: string;
    pfpUrl: string;
    username: string;
    displayName: string;
    bio: string;
  }) {
    this.prodid = data.prodid;
    this.fid = data.fid;
    this.pfpUrl = data.pfpUrl;
    this.username = data.username;
    this.displayName = data.displayName;
    this.bio = data.bio;
  }

  static createFromOldProfileJson(profile: any): FarcasterProfile {
    return new FarcasterProfile({
      prodid: "farcaster",
      fid: "",
      pfpUrl: profile.pfpUrl,
      username: profile.handle,
      displayName: profile.name,
      bio: profile.text,
    });
  }
}

interface ProfileData {
  inputs: object
  version: number
  socials: (FarcasterProfile | TelegramProfile)[]
}

export class Profile {
  inputs: object
  version: number
  socials: (FarcasterProfile | TelegramProfile)[];

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
        FarcasterProfile.createFromOldProfileJson(profile)
      ]
    })
  }
}