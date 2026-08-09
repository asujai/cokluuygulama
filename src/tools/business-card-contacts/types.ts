export interface ExtractedContact {
  firstName: string;
  lastName: string;
  phone: string;
  mobilePhone?: string;
  email: string;
  company: string;
  jobTitle: string;
  website: string;
  address: string;
  notes: string;
  rawOcrText?: string;
}

export interface CardOcrProgress {
  status: string;
  progress: number;
}
