/** Raised when a record does not exist *or* is not owned by the caller (never reveal which). */
export class NotFoundError extends Error {
  constructor(entity: string) {
    super(`${entity} not found`);
    this.name = "NotFoundError";
  }
}

/** A rule the user can fix (duplicate name, missing prerequisite…). The message is shown as-is. */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}
