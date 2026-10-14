// One place that turns thrown errors into JSON the client can show.
// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((e) => e.message).join('. ');
    return res.status(400).json({ message });
  }
  if (err.name === 'CastError') return res.status(400).json({ message: `Invalid ${err.path}` });
  if (err.code === 11000) return res.status(409).json({ message: 'That already exists' });
  if (err.status && err.status < 500) {
    // reasons/errors: content-check and form-field details the client shows next to the form
    return res.status(err.status).json({ message: err.message, ...(err.reasons && { reasons: err.reasons }), ...(err.errors && { errors: err.errors }) });
  }
  // Deliberate upstream / not-configured errors carry a message meant for the user
  if ([502, 503, 504].includes(err.status)) return res.status(err.status).json({ message: err.message });

  console.error(err.stack);
  const body = { message: 'Server error' };
  if (process.env.NODE_ENV !== 'production') body.error = err.message;
  res.status(500).json(body);
};
