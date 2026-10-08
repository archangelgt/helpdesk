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
  "common.configuration_error": "The system is missing configuration. Contact your administrator.",
  "workflow.invalid_transition": "That status change is not allowed from the current status.",
  "workflow.comment_required": "This status change requires a comment.",
  "work_item.without_stages": "This case type does not use stages.",
  "work_item.stages_pending": "The implementation is completed by closing all of its stages.",
  "stage.dependencies_pending": "The stage cannot start: previous stages are not finished yet.",
  "stage.client_requests_pending": "The stage cannot be completed: required client requests are not accepted yet.",
  "stage.requires_client_approval": "This stage needs the client's approval: send it for review.",
  "client_request.invalid_state": "The request is not in a state that allows this action.",
  "auth.current_password_invalid": "The current password is incorrect.",
  "attachment.too_large": "The file is too large (maximum {maxMb} MB).",
  "attachment.missing_file": "No file was received.",
  "users.email_taken": "A user with that email already exists.",
  "users.cannot_change_self": "You can't change your own role or suspend yourself.",
  "users.last_owner": "At least one active owner must remain.",
  "users.use_account_page": "To change your own password use “My account”.",
  "settings.holiday_exists": "There is already a holiday on that day.",
};

export default en;
