#!/usr/bin/env python3
"""
Ktheme Style Linter (ktheme-style-lint)
Detects hardcoded hex color codes and inline style overrides in design components.
Prompts developers to use central design tokens instead.
"""

import sys
import re
import argparse

HEX_COLOR_REGEX = re.compile(r'#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b')

def check_file(filepath):
    violations = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except Exception as e:
        print(f"[ktheme-style-lint] Warning: Could not read file {filepath}: {e}")
        return violations

    for idx, line in enumerate(lines, 1):
        if 'ktheme-ignore' in line or 'ktheme-style-lint-disable' in line:
            continue

        stripped = line.strip()
        # Skip pure single-line comment lines
        if stripped.startswith('//') or stripped.startswith('*') or stripped.startswith('/*'):
            continue

        # Strip CSS var fallbacks e.g. var(--token, #6CFF9A) to avoid flagging fallbacks
        clean_line = re.sub(r'var\([^)]+\)', '', line)

        matches = HEX_COLOR_REGEX.findall(clean_line)
        if matches:
            for hex_code in matches:
                violations.append((idx, stripped, hex_code))

    return violations

def main():
    parser = argparse.ArgumentParser(description="Ktheme Style Linter")
    parser.add_argument("files", nargs="*", help="Files to lint")
    args = parser.parse_args()

    if not args.files:
        sys.exit(0)

    total_violations = 0
    for filepath in args.files:
        violations = check_file(filepath)
        if violations:
            for line_no, line_content, hex_code in violations:
                print(f"[ktheme-style-lint] ERROR: Hardcoded hex color '{hex_code}' found in {filepath}:{line_no}")
                print(f"  Line: {line_content}")
                print(f"  Fix:  Replace hardcoded color with central Ktheme design tokens (e.g. V.pri, V.warn, V.err, or var(--...))\n")
                total_violations += 1

    if total_violations > 0:
        print(f"[ktheme-style-lint] FAILED: Found {total_violations} hardcoded color violation(s).")
        sys.exit(1)

    sys.exit(0)

if __name__ == "__main__":
    main()
