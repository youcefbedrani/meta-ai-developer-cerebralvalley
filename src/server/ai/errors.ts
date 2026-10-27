/** Safe-to-display AI failures. Internal details are logged, never shown. */
export class AIProviderError extends Error {
  constructor(message = "The AI provider failed to respond. Your credits were refunded — please try again.") {
    super(message);
    this.name = "AIProviderError";
  }
}

export class AIInvalidOutputError extends Error {
  constructor(message = "The AI returned an answer we couldn't validate, so we discarded it. Your credits were refunded — please try again.") {
    super(message);
    this.name = "AIInvalidOutputError";
  }
}
