/** Error de la aplicación: `code` es una clave de traducción (ver i18n/locales). */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(code);
    this.name = "AppError";
  }
}

export const Errors = {
  validation: (details?: unknown) => new AppError(400, "validation.invalid", details),
  invalidCredentials: () => new AppError(401, "auth.invalid_credentials"),
  unauthorized: () => new AppError(401, "auth.unauthorized"),
  sessionExpired: () => new AppError(401, "auth.session_expired"),
  accountSuspended: () => new AppError(403, "auth.account_suspended"),
  accountWithoutRole: () => new AppError(403, "auth.account_without_role"),
  forbidden: () => new AppError(403, "auth.forbidden"),
  currentPasswordInvalid: () => new AppError(400, "auth.current_password_invalid"),
  notFound: () => new AppError(404, "common.not_found"),
  /** Regla de negocio que impide la operación (409): el `code` explica cuál. */
  conflict: (code: string, details?: unknown) => new AppError(409, code, details),
  /** Falta configuración en la instancia (ej. un flujo sin estado inicial). */
  configuration: (detail: string) => new AppError(500, "common.configuration_error", { detail }),
};
