#!/usr/bin/env bash
set -e

echo "=== Setting up Git Pre-commit Hooks ==="

# Unset core.hooksPath if set to avoid hook installation conflict
if git config --get core.hooksPath > /dev/null 2>&1; then
    echo "Unsetting git core.hooksPath..."
    git config --global --unset-all core.hooksPath 2>/dev/null || true
    git config --local --unset-all core.hooksPath 2>/dev/null || true
fi

# Check if pre-commit is installed; if not, install via pip3
if ! command -v pre-commit &> /dev/null; then
    echo "Installing pre-commit..."
    pip3 install pre-commit
fi

# Install pre-commit hooks into .git/hooks/pre-commit
echo "Installing Git hook scripts..."
pre-commit install

echo "=== Pre-commit hooks set up successfully! ==="
