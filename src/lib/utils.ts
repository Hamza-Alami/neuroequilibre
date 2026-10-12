import clsx, { type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export const GENDER_LABELS = { male: 'Homme', female: 'Femme' } as const;

export function fullName(client: { first_name: string; last_name: string } | null | undefined) {
  return client ? `${client.first_name} ${client.last_name}` : 'Client supprimé';
}

export function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
