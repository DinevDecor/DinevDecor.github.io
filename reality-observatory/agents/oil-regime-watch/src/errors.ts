export class UnknownSourceError extends Error {
  constructor(sourceId: string) {
    super(`"${sourceId}" is not a configured source for Oil Regime Watch (see config/sources.json).`);
    this.name = "UnknownSourceError";
  }
}

export class MalformedEvidenceError extends Error {
  constructor(reason: string) {
    super(`Refusing to publish malformed Evidence: ${reason}`);
    this.name = "MalformedEvidenceError";
  }
}

export class DuplicateObservationError extends Error {
  constructor(sourceId: string, observationKey: string) {
    super(`Observation "${observationKey}" from source "${sourceId}" was already processed; ignoring duplicate.`);
    this.name = "DuplicateObservationError";
  }
}

export class UnknownPredictionError extends Error {
  constructor(predictionId: string) {
    super(`No pending Prediction "${predictionId}" is tracked by this agent.`);
    this.name = "UnknownPredictionError";
  }
}

export class PredictionAlreadyResolvedError extends Error {
  constructor(predictionId: string, status: string) {
    super(`Prediction "${predictionId}" already reached terminal status "${status}"; cannot resolve or withdraw it again.`);
    this.name = "PredictionAlreadyResolvedError";
  }
}
