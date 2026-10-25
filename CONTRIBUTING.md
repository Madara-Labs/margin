# Contributing to Margin

Thank you for your interest in contributing to **Margin**!

We welcome pull requests from the community to improve typography, reader ergonomics, cognitive instruments, and explorable models.

## How to Contribute

1. **Fork the Repository**: Click the **Fork** button at [https://github.com/Madara-Labs/margin](https://github.com/Madara-Labs/margin) to create your own copy.
2. **Clone your Fork**:
   ```bash
   git clone https://github.com/<your-username>/margin.git
   cd margin
   npm install
   ```
3. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/my-enhancement
   ```
4. **Make and Test Changes**:
   Verify that all unit tests and production builds pass without errors:
   ```bash
   npm run test:all
   npm run build
   ```
5. **Open a Pull Request**:
   - Push your branch to your fork.
   - Open a Pull Request targeting `main` on `Madara-Labs/margin`.
   - Automated CI tests will run on your PR.
   - All PRs are reviewed and merged exclusively by [@momchilgeorgiev](https://github.com/momchilgeorgiev).
