interface TelegramData {
  prodid: string;
  id: number;
  first_name: string;
  last_name: string;
  username: string;
  photo_url: string;
  auth_date: number;
  hash: string;
}

export class TelegramProfile {
  private data: TelegramData;

  constructor(data: TelegramData) {
    this.data = data;
  }

  create(data: TelegramData): TelegramProfile {
    return new TelegramProfile(data);
  }

  update(data: Partial<TelegramData>): TelegramProfile {
    this.data = { ...this.data, ...data };
    return this;
  }

  getData(): TelegramData {
    return this.data;
  }
}