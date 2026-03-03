export class HttpError extends Error {
  public readonly status: number;

  public constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const toHttpError = (error: unknown, fallbackStatus = 500, fallbackMessage = "Internal server error"): HttpError => {
  if (error instanceof HttpError) {
    return error;
  }
  if (error instanceof Error) {
    return new HttpError(fallbackStatus, error.message || fallbackMessage);
  }
  return new HttpError(fallbackStatus, fallbackMessage);
};
