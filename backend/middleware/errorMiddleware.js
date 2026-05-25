// middleware/errorMiddleware.js

// 1. Handles requests made to routes that don't exist (404 Not Found)
const notFound = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error); // Pass the error to the general error handler below
  };
  
  // 2. The general error handler
  const errorHandler = (err, req, res, next) => {
    // Sometimes Express gives a 200 status even on an error; ensure it's at least 400
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    
    res.status(statusCode);
  
    res.json({
      message: err.message,
      // Only send the stack trace if we are NOT in a production environment
      stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
  };
  
  export { notFound, errorHandler };