# Contributing to Copilot - AI-Powered Coding Assistant

Thank you for your interest in contributing to our project! This document provides guidelines and information for contributors.

## 🎯 Project Status

**⚠️ IMPORTANT: This project is currently in DEVELOPMENT MODE**

- Not production-ready
- Active development ongoing
- Features may change
- Breaking changes possible
- Testing and feedback appreciated

## 🤝 How to Contribute

### Types of Contributions We Welcome

1. **🐛 Bug Reports** - Found something broken? Let us know!
2. **✨ Feature Requests** - Have an idea? We'd love to hear it!
3. **📝 Documentation** - Help improve our docs
4. **💻 Code Contributions** - Submit fixes or features
5. **🧪 Testing** - Help test new features
6. **🎨 UI/UX Improvements** - Make it look better!
7. **🔐 Security Fixes** - Report vulnerabilities responsibly

## 📋 Getting Started

### 1. Fork & Clone

```bash
# Fork the repository on GitHub
# Then clone your fork
git clone https://github.com/YOUR_USERNAME/Coding_assistant.git
cd Coding_assistant

# Add upstream remote
git remote add upstream https://github.com/Faizanmal/Coding_assistant.git
```

### 2. Set Up Development Environment

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env and add your API keys

# Install backend dependencies
cd backend-server
npm install
cd ..
```

### 3. Create a Branch

```bash
# Create a new branch for your feature/fix
git checkout -b feature/your-feature-name
# Or for bug fixes
git checkout -b fix/bug-description
```

### 4. Make Changes

- Write clean, readable code
- Follow existing code style
- Add comments where necessary
- Update documentation
- Add tests for new features

### 5. Test Your Changes

```bash
# Run TypeScript compiler
npm run compile

# Run tests
npm test

# Run linter
npm run lint

# Test in VS Code
# Press F5 to launch Extension Development Host
```

### 6. Commit Changes

```bash
# Stage your changes
git add .

# Commit with descriptive message
git commit -m "feat: add amazing new feature"
# Or for bugs
git commit -m "fix: resolve issue with X"
```

**Commit Message Format:**
```
type: brief description

Optional longer description explaining the change
in detail and why it was necessary.

Fixes #123
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### 7. Push & Create Pull Request

```bash
# Push to your fork
git push origin feature/your-feature-name

# Go to GitHub and create a Pull Request
```

## 📝 Pull Request Guidelines

### Before Submitting

- ✅ Code compiles without errors
- ✅ All tests pass
- ✅ Linter shows no errors
- ✅ Documentation updated
- ✅ Changes tested in VS Code
- ✅ No sensitive data committed

### PR Description Should Include

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How has this been tested?

## Screenshots (if applicable)
Visual changes

## Checklist
- [ ] Code follows project style
- [ ] Self-review completed
- [ ] Comments added where needed
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests added/updated
- [ ] All tests pass
```

### Code Review Process

1. **Automated Checks** - CI/CD runs automatically
2. **Maintainer Review** - Project maintainers review code
3. **Feedback** - Address any requested changes
4. **Approval** - Once approved, PR will be merged
5. **Merge** - Maintainer merges into main branch

## 💻 Coding Standards

### TypeScript Style Guide

```typescript
// Use clear, descriptive names
function generateSecurityReport(): SecurityReport {
  // Add comments for complex logic
  const vulnerabilities = scanForVulnerabilities();
  
  // Use const/let, not var
  const report: SecurityReport = {
    timestamp: new Date(),
    findings: vulnerabilities
  };
  
  return report;
}

// Use interfaces for type definitions
interface SecurityReport {
  timestamp: Date;
  findings: Vulnerability[];
  score: number;
}

// Use async/await over callbacks
async function fetchData(): Promise<Data> {
  const response = await fetch(url);
  return await response.json();
}
```

### File Organization

```
src/
├── feature-name.ts           # Main feature implementation
├── feature-name-types.ts     # Type definitions
├── feature-name-utils.ts     # Utility functions
└── tests/
    └── feature-name.test.ts  # Tests
```

### Documentation Standards

```typescript
/**
 * Generate comprehensive security report for workspace
 * 
 * @param workspacePath - Absolute path to workspace
 * @param options - Scan configuration options
 * @returns Promise resolving to security report
 * @throws {Error} If workspace path is invalid
 * 
 * @example
 * ```typescript
 * const report = await generateSecurityReport(
 *   '/path/to/workspace',
 *   { deep: true }
 * );
 * ```
 */
async function generateSecurityReport(
  workspacePath: string,
  options: ScanOptions
): Promise<SecurityReport> {
  // Implementation
}
```

## 🧪 Testing Guidelines

### Writing Tests

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { SecurityScanner } from '../securityscanner';

describe('SecurityScanner', () => {
  let scanner: SecurityScanner;
  
  beforeEach(() => {
    scanner = new SecurityScanner();
  });
  
  it('should detect SQL injection vulnerabilities', async () => {
    const code = 'SELECT * FROM users WHERE id = ' + userId;
    const result = await scanner.scan(code);
    
    expect(result.vulnerabilities).toHaveLength(1);
    expect(result.vulnerabilities[0].type).toBe('sql-injection');
  });
  
  it('should handle empty input gracefully', async () => {
    const result = await scanner.scan('');
    expect(result.vulnerabilities).toHaveLength(0);
  });
});
```

### Test Coverage

- Aim for >80% code coverage
- Test edge cases
- Test error conditions
- Test async operations
- Mock external dependencies

## 🔐 Security Guidelines

### Never Commit

- ❌ API keys or secrets
- ❌ Passwords or tokens
- ❌ Personal data
- ❌ `.env` files (only `.env.example`)
- ❌ Credentials of any kind

### Security Best Practices

```typescript
// ✅ Good - Use environment variables
const apiKey = process.env.GROQ_API_KEY;

// ❌ Bad - Hardcoded secrets
const apiKey = 'gsk_abc123xyz';

// ✅ Good - Sanitize user input
const safe = SecurityUtils.sanitizeInput(userInput);

// ❌ Bad - Direct use of user input
const query = `SELECT * FROM users WHERE name = '${userInput}'`;
```

### Reporting Security Issues

**DO NOT** create public issues for security vulnerabilities!

Instead:
1. Email: faizanmalik8386@gmail.com
2. Subject: "SECURITY: [Brief Description]"
3. Include detailed description
4. Wait for response before disclosure

## 📚 Documentation

### What to Document

- **New Features** - How to use them
- **API Changes** - Breaking changes
- **Configuration** - New settings
- **Commands** - New commands added
- **Troubleshooting** - Common issues

### Where to Document

- **README.md** - User-facing features
- **Code Comments** - Complex logic
- **JSDoc** - Function/class documentation
- **CHANGELOG.md** - Version changes
- **Wiki** - Detailed guides (coming soon)

## 🎨 UI/UX Contributions

### Design Principles

- **Simplicity** - Keep it simple and intuitive
- **Consistency** - Follow VS Code design language
- **Accessibility** - Support keyboard navigation
- **Performance** - Fast and responsive
- **Feedback** - Clear user feedback

### Before Submitting UI Changes

- Test in light and dark themes
- Test keyboard navigation
- Test screen reader compatibility
- Provide screenshots/videos
- Consider user experience

## 🐛 Bug Report Guidelines

### Good Bug Report Includes

```markdown
## Bug Description
Clear description of the bug

## Steps to Reproduce
1. Open extension
2. Click on X
3. See error

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- VS Code Version: 1.85.0
- Extension Version: 1.0.0
- OS: Windows 11
- Node.js: 18.12.0

## Error Logs
```
Paste error logs here
```

## Screenshots
If applicable
```

## ✨ Feature Request Guidelines

### Good Feature Request Includes

```markdown
## Feature Description
Clear description of the feature

## Use Case
Why is this needed?

## Proposed Solution
How should it work?

## Alternatives Considered
Other approaches considered

## Additional Context
Mockups, examples, etc.
```

## 📞 Getting Help

### Communication Channels

- **GitHub Issues** - Bug reports & features
- **GitHub Discussions** - Questions & ideas
- **Email** - faizanmalik8386@gmail.com

### Response Times

- Issues: Usually within 48 hours
- Pull Requests: Within 1 week
- Security Reports: Within 24 hours

## 🎯 Development Roadmap

### Current Focus

- [ ] Performance optimization
- [ ] Enhanced error handling
- [ ] Additional AI models
- [ ] Improved documentation
- [ ] Extended test coverage

### Future Plans

- [ ] VS Code Marketplace release
- [ ] Offline mode support
- [ ] Team collaboration features
- [ ] Mobile companion app
- [ ] API for integrations

## 📜 Code of Conduct

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone, regardless of:

- Age, body size, disability
- Ethnicity, gender identity
- Experience level
- Nationality, personal appearance
- Race, religion
- Sexual identity and orientation

### Our Standards

**Positive Behavior:**
- ✅ Using welcoming language
- ✅ Being respectful
- ✅ Accepting constructive criticism
- ✅ Focusing on what's best for community
- ✅ Showing empathy

**Unacceptable Behavior:**
- ❌ Trolling or insulting comments
- ❌ Personal or political attacks
- ❌ Harassment of any kind
- ❌ Publishing private information
- ❌ Unprofessional conduct

### Enforcement

Violations may result in:
1. Warning
2. Temporary ban
3. Permanent ban

Report violations to: faizanmalik8386@gmail.com

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🙏 Thank You!

Thank you for contributing to Copilot - AI-Powered Coding Assistant! Every contribution, no matter how small, helps make this project better.

### Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Appreciated by the community! 🎉

---

**Questions?** Feel free to ask in [GitHub Discussions](https://github.com/Faizanmal/Coding_assistant/discussions)

**Happy Contributing! 🚀**
