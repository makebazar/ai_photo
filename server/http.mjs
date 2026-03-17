export function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

export function isDev() {
  return process.env.NODE_ENV !== "production";
}

