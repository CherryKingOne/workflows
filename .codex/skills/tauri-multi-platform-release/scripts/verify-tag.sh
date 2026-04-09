#!/bin/bash

# Verify Release Tag Script
# Ensures tag follows semantic versioning and is ready for release

set -e

TAG=$1

if [ -z "$TAG" ]; then
  echo "Usage: $0 <tag>"
  echo "Example: $0 v1.0.0"
  exit 1
fi

# Check tag format
if [[ ! "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]]; then
  echo "Error: Invalid tag format"
  echo "Expected format: v1.0.0 or v1.0.0-beta.1"
  exit 1
fi

# Extract version
VERSION=${TAG#v}
echo "Version: $VERSION"

# Check if tag exists locally
if git tag -l | grep -q "^$TAG$"; then
  echo "Warning: Tag $TAG already exists locally"
  read -p "Delete and recreate? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    git tag -d "$TAG"
  else
    echo "Aborted"
    exit 1
  fi
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
  echo "Error: Uncommitted changes detected"
  echo "Please commit or stash changes before creating a release tag"
  git status --short
  exit 1
fi

# Check if on main branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
  echo "Warning: Not on main branch (current: $BRANCH)"
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted"
    exit 1
  fi
fi

# Check if upstream is in sync
git fetch origin
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/$BRANCH)

if [ "$LOCAL" != "$REMOTE" ]; then
  echo "Error: Local branch is not in sync with remote"
  echo "Please push or pull changes before creating a release tag"
  exit 1
fi

# Verify version matches
PACKAGE_VERSION=$(node -p "require('./package.json').version")
TAURI_VERSION=$(node -p "require('./src-tauri/tauri.conf.json').version")

if [ "$VERSION" != "$PACKAGE_VERSION" ]; then
  echo "Error: Version mismatch"
  echo "Tag version: $VERSION"
  echo "package.json version: $PACKAGE_VERSION"
  exit 1
fi

if [ "$VERSION" != "$TAURI_VERSION" ]; then
  echo "Error: Version mismatch"
  echo "Tag version: $VERSION"
  echo "tauri.conf.json version: $TAURI_VERSION"
  exit 1
fi

# Check CHANGELOG
if [ -f "CHANGELOG.md" ]; then
  if ! grep -q "## \[$VERSION\]" CHANGELOG.md; then
    echo "Warning: Version $VERSION not found in CHANGELOG.md"
    read -p "Continue without CHANGELOG entry? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo "Aborted"
      exit 1
    fi
  fi
fi

echo -e "\nAll checks passed!"
echo "Ready to create tag: $TAG"
echo ""
read -p "Create and push tag? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  git tag -a "$TAG" -m "Release $TAG"
  git push origin "$TAG"
  echo -e "\nTag created and pushed!"
  echo "GitHub Actions will now build the release."
else
  echo "Aborted"
fi
