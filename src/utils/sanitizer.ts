/**
 * Advanced Security utilities for comprehensive input sanitization and validation
 * Enterprise-grade security functions with multiple layers of protection
 */

import * as crypto from 'crypto';
import * as path from 'path';

export class SecurityUtils {
    // Security constants
    private static readonly MAX_LOG_LENGTH = 1000;
    private static readonly MAX_PATH_LENGTH = 260; // Windows MAX_PATH limit
    private static readonly MAX_FILENAME_LENGTH = 255;
    private static readonly DANGEROUS_PATTERNS = [
        /<script[^>]*>[\s\S]*?<\/script>/gi,
        /javascript:/gi,
        /vbscript:/gi,
        /on\w+\s*=/gi,
        /data:text\/html/gi,
        /eval\s*\(/gi,
        /Function\s*\(/gi,
        /setTimeout\s*\(/gi,
        /setInterval\s*\(/gi
    ];

    /**
     * Enhanced log input sanitization with multiple security layers
     */
    static sanitizeLogInput(input: any): string {
        if (input === null || input === undefined) {
            return 'null';
        }

        let sanitized = String(input);
        
        // Remove control characters and normalize line breaks
        sanitized = sanitized
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '') // Remove control chars
            .replace(/[\r\n\t]/g, ' ') // Normalize whitespace
            .replace(/\s+/g, ' ') // Collapse multiple spaces
            .trim();

        // Remove potential XSS patterns
        for (const pattern of this.DANGEROUS_PATTERNS) {
            sanitized = sanitized.replace(pattern, '[FILTERED]');
        }

        // Remove potential secrets (basic patterns)
        sanitized = this.sanitizeSecrets(sanitized);

        // Truncate to prevent log injection attacks
        if (sanitized.length > this.MAX_LOG_LENGTH) {
            sanitized = sanitized.substring(0, this.MAX_LOG_LENGTH) + '...[TRUNCATED]';
        }

        return sanitized;
    }

    /**
     * Advanced file path validation with security checks
     */
    static validateFilePath(filePath: string, basePath: string): string {
        if (!filePath || typeof filePath !== 'string') {
            throw new Error('Invalid file path provided');
        }

        if (filePath.length > this.MAX_PATH_LENGTH) {
            throw new Error('File path too long');
        }

        // Normalize path separators and resolve
        const normalizedPath = path.normalize(filePath);
        const resolvedPath = path.resolve(basePath, normalizedPath);
        const resolvedBasePath = path.resolve(basePath);

        // Check for path traversal
        if (!resolvedPath.startsWith(resolvedBasePath + path.sep) && resolvedPath !== resolvedBasePath) {
            throw new Error('Path traversal attempt detected');
        }

        // Check for dangerous file patterns
        const fileName = path.basename(resolvedPath);
        if (this.isDangerousFileName(fileName)) {
            throw new Error('Dangerous file name detected');
        }

        return resolvedPath;
    }

    /**
     * Enhanced filename sanitization with comprehensive checks
     */
    static sanitizeFilename(filename: string): string {
        if (!filename || typeof filename !== 'string') {
            throw new Error('Invalid filename provided');
        }

        let sanitized = filename
            // Remove path separators and dangerous characters
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
            // Remove path traversal sequences
            .replace(/\.\./g, '')
            // Remove leading/trailing dots and spaces
            .replace(/^[.\s]+|[.\s]+$/g, '')
            // Normalize spaces
            .replace(/\s+/g, '_');

        // Check for reserved Windows names
        const reservedNames = [
            'CON', 'PRN', 'AUX', 'NUL',
            'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
            'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
        ];

        const nameWithoutExt = path.parse(sanitized).name.toUpperCase();
        if (reservedNames.includes(nameWithoutExt)) {
            sanitized = `safe_${sanitized}`;
        }

        // Ensure length limits
        if (sanitized.length > this.MAX_FILENAME_LENGTH) {
            const ext = path.extname(sanitized);
            const name = path.basename(sanitized, ext);
            const maxNameLength = this.MAX_FILENAME_LENGTH - ext.length;
            sanitized = name.substring(0, maxNameLength) + ext;
        }

        // Ensure not empty
        if (!sanitized || sanitized.length === 0) {
            sanitized = 'untitled';
        }

        return sanitized;
    }

    /**
     * Validate and sanitize URL inputs
     */
    static sanitizeUrl(url: string): string {
        if (!url || typeof url !== 'string') {
            throw new Error('Invalid URL provided');
        }

        // Allow only specific protocols
        const allowedProtocols = ['http:', 'https:', 'ftp:', 'ftps:'];
        
        try {
            const urlObj = new URL(url);
            
            if (!allowedProtocols.includes(urlObj.protocol)) {
                throw new Error('Protocol not allowed');
            }

            // Remove dangerous patterns
            let sanitized = url;
            for (const pattern of this.DANGEROUS_PATTERNS) {
                sanitized = sanitized.replace(pattern, '');
            }

            return sanitized;
        } catch (error) {
            throw new Error('Invalid URL format');
        }
    }

    /**
     * Sanitize environment variable values
     */
    static sanitizeEnvironmentValue(value: string): string {
        if (!value || typeof value !== 'string') {
            return '';
        }

        // Remove dangerous characters but preserve valid env var content
        return value
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars except \n and \r
            .replace(/[`$\\]/g, '') // Remove shell escape characters
            .trim();
    }

    /**
     * Validate API keys and tokens
     */
    static validateApiKey(apiKey: string): boolean {
        if (!apiKey || typeof apiKey !== 'string') {
            return false;
        }

        // Basic API key validation
        const minLength = 16;
        const maxLength = 512;
        
        if (apiKey.length < minLength || apiKey.length > maxLength) {
            return false;
        }

        // Check for valid characters (alphanumeric + common symbols)
        const validPattern = /^[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=]+$/;
        if (!validPattern.test(apiKey)) {
            return false;
        }

        return true;
    }

    /**
     * Generate secure random tokens
     */
    static generateSecureToken(length: number = 32): string {
        if (length < 16 || length > 256) {
            throw new Error('Token length must be between 16 and 256');
        }

        return crypto.randomBytes(length).toString('hex');
    }

    /**
     * Hash sensitive data for logging
     */
    static hashSensitiveData(data: string): string {
        return crypto.createHash('sha256').update(data).digest('hex').substring(0, 8) + '...';
    }

    /**
     * Validate input against injection patterns
     */
    static validateInput(input: string, context: 'sql' | 'html' | 'js' | 'command' | 'generic' = 'generic'): boolean {
        if (!input || typeof input !== 'string') {
            return false;
        }

        const patterns = {
            sql: [
                /('\s*(or|and)\s*')/gi,
                /(union\s+select)/gi,
                /(drop\s+table)/gi,
                /(insert\s+into)/gi,
                /(delete\s+from)/gi,
                /(\-\-|\#|\/\*)/gi
            ],
            html: [
                /<script[^>]*>[\s\S]*?<\/script>/gi,
                /<iframe[^>]*>[\s\S]*?<\/iframe>/gi,
                /<object[^>]*>[\s\S]*?<\/object>/gi,
                /<embed[^>]*>/gi,
                /on\w+\s*=/gi
            ],
            js: [
                /eval\s*\(/gi,
                /Function\s*\(/gi,
                /setTimeout\s*\(/gi,
                /setInterval\s*\(/gi,
                /document\.write/gi
            ],
            command: [
                /[;&|`$()]/g,
                /\.\.\//g,
                /\/etc\/passwd/gi,
                /\/bin\//gi,
                /(rm\s+-rf)/gi
            ],
            generic: this.DANGEROUS_PATTERNS
        };

        const contextPatterns = patterns[context] || patterns.generic;
        
        for (const pattern of contextPatterns) {
            if (pattern.test(input)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Escape output for safe display
     */
    static escapeOutput(output: string, context: 'html' | 'js' | 'attr' = 'html'): string {
        if (!output || typeof output !== 'string') {
            return '';
        }

        switch (context) {
            case 'html':
                return output
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#x27;');
            
            case 'js':
                return output
                    .replace(/\\/g, '\\\\')
                    .replace(/'/g, "\\'")
                    .replace(/"/g, '\\"')
                    .replace(/\n/g, '\\n')
                    .replace(/\r/g, '\\r')
                    .replace(/\t/g, '\\t');
            
            case 'attr':
                return output
                    .replace(/&/g, '&amp;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#x27;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
            
            default:
                return output;
        }
    }

    /**
     * Sanitize potential secrets from strings
     */
    private static sanitizeSecrets(input: string): string {
        // Pattern for potential API keys, tokens, etc.
        const secretPatterns = [
            /([A-Za-z0-9_-]{20,})/g, // Generic long alphanumeric strings
            /(sk_[A-Za-z0-9_-]{20,})/g, // Stripe-like secret keys
            /(ey[A-Za-z0-9_-]{20,})/g, // JWT-like tokens
            /([A-Fa-f0-9]{32,})/g, // Hex strings (potential hashes/keys)
        ];

        let sanitized = input;
        for (const pattern of secretPatterns) {
            sanitized = sanitized.replace(pattern, (match) => {
                if (match.length > 16) {
                    return match.substring(0, 4) + '***' + match.substring(match.length - 4);
                }
                return match;
            });
        }

        return sanitized;
    }

    /**
     * Check if filename is potentially dangerous
     */
    private static isDangerousFileName(fileName: string): boolean {
        const dangerousExtensions = [
            '.exe', '.bat', '.cmd', '.scr', '.vbs', '.js', '.jar',
            '.com', '.pif', '.msi', '.ps1', '.sh', '.php'
        ];

        const extension = path.extname(fileName).toLowerCase();
        return dangerousExtensions.includes(extension);
    }

    /**
     * Rate limiting helper
     */
    static createRateLimiter(windowMs: number, maxRequests: number): (key: string) => boolean {
        const requests = new Map<string, { count: number; resetTime: number }>();

        return (key: string): boolean => {
            const now = Date.now();
            const record = requests.get(key);

            if (!record || now > record.resetTime) {
                requests.set(key, { count: 1, resetTime: now + windowMs });
                return true;
            }

            if (record.count >= maxRequests) {
                return false;
            }

            record.count++;
            return true;
        };
    }

    /**
     * Secure comparison to prevent timing attacks
     */
    static secureCompare(a: string, b: string): boolean {
        if (a.length !== b.length) {
            return false;
        }

        let result = 0;
        for (let i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }

        return result === 0;
    }

    /**
     * Generate Content Security Policy
     */
    static generateCSP(options: {
        defaultSrc?: string[];
        scriptSrc?: string[];
        styleSrc?: string[];
        imgSrc?: string[];
        connectSrc?: string[];
    } = {}): string {
        const csp = {
            'default-src': options.defaultSrc || ["'self'"],
            'script-src': options.scriptSrc || ["'self'"],
            'style-src': options.styleSrc || ["'self'", "'unsafe-inline'"],
            'img-src': options.imgSrc || ["'self'", "data:", "https:"],
            'connect-src': options.connectSrc || ["'self'"],
            'font-src': ["'self'"],
            'object-src': ["'none'"],
            'media-src': ["'self'"],
            'frame-src': ["'none'"],
            'frame-ancestors': ["'none'"],
            'base-uri': ["'self'"],
            'form-action': ["'self'"]
        };

        return Object.entries(csp)
            .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
            .join('; ');
    }
}