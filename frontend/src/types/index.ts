export interface User {
  id: number;
  email: string;
  importance_context: string | null;
}

export interface Bucket {
  id: number;
  name: string;
  description: string;
  examples: string[];
  email_count: number;
}

export interface Email {
  id: number;
  thread_id: string;
  subject: string;
  sender: string;
  snippet: string;
  date: string | null;
  bucket_ids: number[];
  bucket_names: string[];
}

export interface Feedback {
  id: number;
  email_id: number;
  bucket_id: number;
  is_positive: boolean;
  correct_bucket_ids: number[];
  reason: string;
  created_at: string;
}

export interface ClassifiedEvent {
  event: 'classified';
  data: {
    email_id: number;
    thread_id: string;
    subject: string;
    sender: string;
    snippet: string;
    date: string | null;
    bucket_names: string[];
    bucket_ids: number[];
    progress: number;
    total: number;
  };
}

export interface ErrorEvent {
  event: 'error';
  data: {
    email_id: number;
    subject: string;
    error: string;
    progress: number;
    total: number;
  };
}

export interface DoneEvent {
  event: 'done';
  data: {
    classified: number;
    failed: number;
    total: number;
    skipped?: boolean;
  };
}

export type SSEEvent = ClassifiedEvent | ErrorEvent | DoneEvent;
