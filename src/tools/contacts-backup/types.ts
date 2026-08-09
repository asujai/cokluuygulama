export interface VcfPhone {
  type?: string;
  number: string;
}

export interface VcfEmail {
  type?: string;
  email: string;
}

export interface VcfContact {
  id: string;
  firstName?: string;
  lastName?: string;
  formattedName: string;
  phoneNumbers: VcfPhone[];
  emails: VcfEmail[];
  organization?: string;
  jobTitle?: string;
  note?: string;
  selected?: boolean;
}

export type BackupTab = 'export' | 'import';
