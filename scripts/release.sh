#!/bin/bash

# WeiMeng Release Script
# Usage: ./scripts/release.sh [patch|minor|major] [release notes]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")

echo -e "${GREEN}Current version: ${CURRENT_VERSION}${NC}"

# Determine version bump type
BUMP_TYPE=${1:-patch}

# Calculate new version
case $BUMP_TYPE in
  major)
    NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{$1++; $2=0; $3=0} 1' OFS=.)
    ;;
  minor)
    NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{$2++; $3=0} 1' OFS=.)
    ;;
  patch)
    NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{$3++} 1' OFS=.)
    ;;
  *)
    echo -e "${RED}Invalid bump type. Use: patch, minor, or major${NC}"
    exit 1
    ;;
esac

echo -e "${YELLOW}New version will be: ${NEW_VERSION}${NC}"

# Update version in package.json
npm version $NEW_VERSION --no-git-tag-version

# Update version in tauri.conf.json
node -e "const fs = require('fs'); const conf = JSON.parse(fs.readFileSync('./src-tauri/tauri.conf.json', 'utf8')); conf.version = '$NEW_VERSION'; fs.writeFileSync('./src-tauri/tauri.conf.json', JSON.stringify(conf, null, 2));"

echo -e "${GREEN}Version updated to ${NEW_VERSION}${NC}"

# Ask for release notes
RELEASE_NOTES=${2:-"Release v${NEW_VERSION}"}

# Commit changes
git add package.json src-tauri/tauri.conf.json
git commit -m "chore: bump version to ${NEW_VERSION}"

# Create git tag
git tag -a "v${NEW_VERSION}" -m "${RELEASE_NOTES}"

echo -e "${GREEN}Created git tag: v${NEW_VERSION}${NC}"
echo -e "${YELLOW}Pushing to GitHub...${NC}"

# Push commit and tag
git push origin main
git push origin "v${NEW_VERSION}"

echo -e "${GREEN}Successfully published version ${NEW_VERSION}!${NC}"
echo -e "${YELLOW}GitHub Actions will now build and create a release.${NC}"
echo -e "${YELLOW}Check progress at: https://github.com/YOUR_USERNAME/workflows/actions${NC}"
