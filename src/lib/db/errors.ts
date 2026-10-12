interface PgLikeError {
  message?: string;
  code?: string;
  hint?: string | null;
  details?: string | null;
}

export type AppErrorKind = 'slot' | 'gap' | 'permission' | 'conflict' | 'network' | 'unknown';

export class AppError extends Error {
  kind: AppErrorKind;

  constructor(message: string, kind: AppErrorKind = 'unknown') {
    super(message);
    this.kind = kind;
  }
}

export function toAppError(error: unknown, context?: string): AppError {
  if (error instanceof AppError) return error;
  const e = (error ?? {}) as PgLikeError;
  const message = e.message ?? '';

  if (e.hint === 'SLOT_ERROR') return new AppError(message, 'slot');
  if (e.hint === 'GAP_WARNING') return new AppError(message, 'gap');

  if (e.code === '23505') {
    if (message.includes('sessions_box_start_unique')) {
      return new AppError('Ce créneau est déjà réservé dans ce box.', 'slot');
    }
    if (message.includes('boxes_name_key')) {
      return new AppError('Un box porte déjà ce nom.', 'conflict');
    }
    return new AppError('Cet élément existe déjà.', 'conflict');
  }
  if (e.code === '23503') {
    if (context === 'box') {
      return new AppError(
        'Ce box a des séances enregistrées : désactivez-le plutôt que de le supprimer.',
        'conflict'
      );
    }
    return new AppError('Cet élément est utilisé ailleurs et ne peut pas être supprimé.', 'conflict');
  }
  if (e.code === '42501' || message.includes('row-level security')) {
    return new AppError('Action réservée à l\u2019administrateur.', 'permission');
  }
  if (e.code === 'PGRST116') {
    return new AppError('Élément introuvable ou accès refusé.', 'permission');
  }
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return new AppError('Connexion impossible. Vérifiez votre accès internet.', 'network');
  }
  return new AppError(message || 'Une erreur inattendue est survenue.');
}

export function errorMessage(error: unknown) {
  return toAppError(error).message;
}

/** Unwrap a Supabase response, throwing a translated error. */
export function unwrap<T>(result: { data: T | null; error: PgLikeError | null }, context?: string): T {
  if (result.error) throw toAppError(result.error, context);
  return result.data as T;
}
