const { ZodError } = require('zod');
const config = require('../config/env');

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** Validate `req.body` (or another source) against a zod schema and return the parsed value. */
function validate(schema, data) {
  return schema.parse(data);
}

function notFound(req, res) {
  res.status(404).json({ message: 'Route not found' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    const errors = {};
    for (const issue of err.issues) {
      const field = issue.path.join('.') || 'form';
      if (!errors[field]) errors[field] = issue.message;
    }
    return res.status(422).json({ message: Object.values(errors)[0] || 'Invalid input', errors });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'Image is too large (max 5 MB)' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Malformed JSON body' });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    message: status >= 500 && config.isProd ? 'Something went wrong. Please try again.' : err.message,
    ...(err.details ? { details: err.details } : {}),
  });
}

module.exports = { HttpError, validate, notFound, errorHandler };
