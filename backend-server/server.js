const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const validator = require('validator');
const fetch = global.fetch;
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "https://api.groq.com"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use(limiter);

// CORS with restrictions
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'vscode-webview://',
      'https://localhost:3000',
      'http://localhost:3000'
    ];
    
    if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Body parser with size limits
app.use(bodyParser.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).json({ error: 'Invalid JSON' });
      return;
    }
  }
}));

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        // Remove potential XSS and injection attempts
        req.body[key] = validator.escape(req.body[key]);
        // Limit string length
        if (req.body[key].length > 10000) {
          return res.status(400).json({ error: 'Input too long' });
        }
      }
    }
  }
  next();
};

app.use(sanitizeInput);

// API key validation middleware
const validateApiKey = (req, res, next) => {
  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'Server configuration error' });
  }
  next();
};

// Input validation functions
const validatePrompt = (prompt) => {
  if (!prompt || typeof prompt !== 'string') {
    return { valid: false, error: 'Invalid or missing prompt' };
  }
  
  if (prompt.length < 1 || prompt.length > 10000) {
    return { valid: false, error: 'Prompt length must be between 1 and 10000 characters' };
  }
  
  // Check for potential injection attempts
  const dangerousPatterns = [
    /eval\s*\(/i,
    /function\s*\(/i,
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(prompt)) {
      return { valid: false, error: 'Potentially dangerous content detected' };
    }
  }
  
  return { valid: true };
};

app.post('/complete', validateApiKey, async (req, res) => {
  try {
    const { prompt } = req.body;
    
    // Validate input
    const validation = validatePrompt(prompt);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Sanitize prompt further
    const sanitizedPrompt = prompt
      .replace(/[\r\n]/g, ' ') // Remove newlines
      .replace(/[\x00-\x1f\x7f-\x9f]/g, '') // Remove control characters
      .substring(0, 5000); // Limit length
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'User-Agent': 'VSCode-Extension/1.0.0'
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          { 
            role: 'system', 
            content: 'You are a helpful code assistant. Provide only safe, clean code with no explanation or markdown formatting. Include comments in code if needed.'
          },
          { role: 'user', content: sanitizedPrompt }
        ],
        temperature: 0.6,
        max_tokens: 500,
      }),
      timeout: 30000 // 30 second timeout
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    
    if (!raw) {
      return res.status(500).json({ error: 'No completion returned from API' });
    }
    
    const completion = extractCodeFromMarkdown(raw);
    
    // Sanitize output
    const sanitizedCompletion = sanitizeOutput(completion);
    
    res.json({ 
      completion: sanitizedCompletion.trim(),
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    // Log error securely (don't expose sensitive info)
    console.error('API error:', {
      message: err.message,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch completion',
      timestamp: new Date().toISOString()
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', {
    message: err.message,
    timestamp: new Date().toISOString(),
    ip: req.ip
  });
  
  res.status(500).json({ 
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`✅ Secure server listening on http://127.0.0.1:${PORT}`);
  console.log(`🔒 Security features enabled: Rate limiting, CORS, Helmet, Input validation`);
});

function extractCodeFromMarkdown(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  const codeBlockMatch = text.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  return text.trim();
}

function sanitizeOutput(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  return text
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove script tags
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .substring(0, 50000); // Limit output size
}
