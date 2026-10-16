import type { Request, Response } from 'express';

export class ServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details: unknown = {},
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export function requirePathParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new ServiceError(`Route parameter '${name}' is required`, 400, 'ROUTE_PARAMETER_REQUIRED');
  }
  if (name === 'id' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new ServiceError('Provide a valid record UUID', 400, 'INVALID_RECORD_ID');
  }
  return value;
}

export function sendApiError(res: Response, req: Request, error: ServiceError): void {
  res.status(error.status).json({
    code: error.code,
    message: error.message,
    details: error.details,
    correlationId: req.correlationId,
  });
}

export function sendApiErrorResponse(
  res: Response,
  req: Request,
  status: number,
  code: string,
  message: string,
  details: unknown = {},
): void {
  res.status(status).json({ code, message, details, correlationId: req.correlationId });
}
