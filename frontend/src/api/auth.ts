import client from './client';
import type { User } from '../types';

export async function getLoginUrl(): Promise<string> {
  const { data } = await client.get<{ url: string }>('/auth/login');
  return data.url;
}

export async function getMe(): Promise<User> {
  const { data } = await client.get<User>('/auth/me');
  return data;
}
