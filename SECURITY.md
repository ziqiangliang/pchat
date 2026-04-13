# Security Policy

## Supported Versions

| Version | Status       |
|---------|--------------|
| 0.1.x   | :white_check_mark: Current |

## Reporting a Vulnerability

If you discover a security vulnerability within PChat, please report it responsibly.

### How to Report

**Please DO NOT** report security vulnerabilities through public GitHub issues.

Instead, please send the details to us via one of the following methods:

- **Preferred**: Create a private security advisory via GitHub
  - Navigate to the [Security tab](https://github.com/pchat/pchat/security/advisories/new)
  - Select "Report a vulnerability"
  - Fill out the form with detailed information

- **Email**: Send an email to the maintainers with:
  - Description of the vulnerability
  - Steps to reproduce
  - Potential impact
  - Any suggested fixes (if applicable)

### What to Expect

After reporting a vulnerability, you can expect:

1. **Acknowledgment**: We will acknowledge receipt of your report within 48 hours
2. **Initial Assessment**: We will assess the severity and impact of the vulnerability
3. **Status Updates**: We will keep you informed of our progress
4. **Resolution**: Once fixed, we will:
   - Credit you in the release notes (unless you prefer anonymity)
   - Provide a CVE or similar identifier if applicable
   - Publish a security advisory on GitHub

### Scope

This security policy applies to:
- The main PChat application
- Core plugins and extensions
- Official integrations

Third-party services and plugins are governed by their own security policies.

## Security Best Practices

When using PChat:

- Never commit API keys or secrets to the repository
- Use environment variables for sensitive configuration
- Regularly update dependencies to the latest stable versions
- Review the `.env.example` file for required environment variables
