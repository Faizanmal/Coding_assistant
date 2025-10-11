const validator = require('validator');

/**
 * Security middleware for input validation and sanitization
 */

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        // Remove potential XSS and injection attempts
        req.body[key] = validator.escape(req.body[key]);
        
        // Limit string length
        const maxLength = process.env.MAX_PROMPT_LENGTH || 10000;
        if (req.body[key].length > maxLength) {
          return res.status(400).json({ 
            error: `Input too long. Maximum ${maxLength} characters allowed.` 
          });
        }
      }
    }
  }
  next();
};

// API key validation middleware
const validateApiKey = (req, res, next) => {
  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'Server configuration error' });
  }
  next();
};

// Request logging middleware (security-focused)
const securityLogger = (req, res, next) => {
  const logData = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentLength: req.get('Content-Length')
  };
  
  // Log suspicious patterns
  const suspiciousPatterns = [
    /\.\.\//,  // Path traversal
    /<script/i, // XSS attempts
    /union.*select/i, // SQL injection
    /eval\(/i, // Code injection
  ];
  
  const requestString = JSON.stringify(req.body);
  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(requestString) || pattern.test(req.url)
  );
  
  if (isSuspicious) {
    console.warn('🚨 Suspicious request detected:', logData);
  }
  
  next();
};

// Input validation functions
const validatePrompt = (prompt) => {
  if (!prompt || typeof prompt !== 'string') {
    return { valid: false, error: 'Invalid or missing prompt' };
  }
  
  const maxLength = process.env.MAX_PROMPT_LENGTH || 10000;
  if (prompt.length < 1 || prompt.length > maxLength) {
    return { 
      valid: false, 
      error: `Prompt length must be between 1 and ${maxLength} characters` 
    };
  }
  
  // Check for potential injection attempts
  const dangerousPatterns = [
    /eval\s*\(/i,
    /function\s*\(/i,
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /\.\.\//g, // Path traversal
    /\/etc\/passwd/i,
    /cmd\.exe/i,
    /powershell/i
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(prompt)) {
      return { valid: false, error: 'Potentially dangerous content detected' };
    }
  }
  
  return { valid: true };
};

// Output sanitization
const sanitizeOutput = (text) => {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  const maxLength = process.env.MAX_OUTPUT_LENGTH || 50000;
  
  return text
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove script tags
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/eval\s*\(/gi, '') // Remove eval calls
    .substring(0, maxLength); // Limit output size
};

module.exports = {
  sanitizeInput,
  validateApiKey,
  securityLogger,
  validatePrompt,
  sanitizeOutput
};