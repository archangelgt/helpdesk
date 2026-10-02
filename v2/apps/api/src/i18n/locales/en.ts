import type es from "./es.js";

const en: Record<keyof typeof es, string> = {
  "validation.invalid": "The submitted data is not valid.",
  "auth.invalid_credentials": "Incorrect email or password.",
  "auth.unauthorized": "You need to sign in.",
  "auth.session_expired": "Your session has expired. Please sign in again.",
  "auth.account_suspended": "Your account is suspended. Contact your administrator.",
  "auth.account_without_role": "Your account has no role assigned. Contact your administrator.",
  "auth.forbidden": "You don't have permission to perform this action.",
  "common.not_found": "The requested resource was not found.",
  "common.too_many_requests": "Too many attempts. Please wait a moment and try again.",
  "common.internal_error": "An unexpected error occurred. Please try again.",
};

export default en;
