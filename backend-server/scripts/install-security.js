#!/usr/bin/env node

/**
 * Security setup script for backend server
 * Installs security dependencies and validates configuration
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔒 Setting up backend security...\n');

// Install security dependencies
console.log('📦 Installing security dependencies...');
try {
  execSync('npm install express-rate-limit helmet validator', { stdio: 'inherit' });
  console.log('✅ Security dependencies installed\n');
} catch (error) {
  console.error('❌ Failed to install dependencies:', error.message);
  process.exit(1);
}

// Check for .env file
console.log('🔍 Checking environment configuration...');
const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.example');

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(envExamplePath)) {
    console.log('📋 Copying .env.example to .env...');
    fs.copyFileSync(envExamplePath, envPath);
    console.log('⚠️  Please update .env with your actual API keys');
  } else {
    console.log('⚠️  No .env file found. Please create one with your API keys.');
  }
} else {
  console.log('✅ .env file exists');
}

// Validate environment variables
console.log('\n🔧 Validating configuration...');
require('dotenv').config({ path: envPath });

const requiredVars = ['GROQ_API_KEY'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.log('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.log(`   - ${varName}`));
  console.log('\nPlease update your .env file with the missing variables.');
} else {
  console.log('✅ All required environment variables are set');
}

// Security recommendations
console.log('\n🛡️  Security Recommendations:');
console.log('1. Keep API keys secure and never commit them to version control');
console.log('2. Use HTTPS in production environments');
console.log('3. Configure rate limiting based on your usage patterns');
console.log('4. Regularly update dependencies for security patches');
console.log('5. Monitor logs for suspicious activity');

console.log('\n🚀 Backend security setup complete!');
console.log('Run "npm start" to start the secure server.');