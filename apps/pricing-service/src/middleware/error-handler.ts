import type { ErrorRequestHandler } from 'express';
import multer from 'multer';
import { config } from '../config';
import { ServiceError } from '../services/http-service';

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  if (error instanceof ServiceError) {
    res.status(error.status).json({
      code: error.code,
      message: error.message,
      details: error.details,
      correlationId: req.correlationId,
    });
    return;
  }
  if (error instanceof multer.MulterError) {
    const tooLarge = error.code === 'LIMIT_FILE_SIZE';
    res.status(tooLarge ? 413 : 400).json({
      code: tooLarge ? 'UPLOAD_TOO_LARGE' : 'UPLOAD_ERROR',
      message: tooLarge ? `CSV exceeds the ${config.maxUploadBytes} byte limit` : error.message,
      details: {},
      correlationId: req.correlationId,
    });
    return;
  }
  if (error instanceof Error && 'type' in error) {
    if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large') {
      const tooLarge = error.type === 'entity.too.large';
      res.status(tooLarge ? 413 : 400).json({ code: tooLarge ? 'REQUEST_TOO_LARGE' : 'INVALID_JSON', message: tooLarge ? 'Request body exceeds the size limit' : 'Request body must contain valid JSON', details: {}, correlationId: req.correlationId });
      return;
    }
  }
  if (error instanceof Error && error.message === 'Only .csv files are allowed') {
    res.status(415).json({ code: 'UNSUPPORTED_FILE_TYPE', message: error.message, details: {}, correlationId: req.correlationId });
    return;
  }
  req.log?.error({ error }, 'Unhandled API error');
  res.status(500).json({ code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {}, correlationId: req.correlationId });
};
