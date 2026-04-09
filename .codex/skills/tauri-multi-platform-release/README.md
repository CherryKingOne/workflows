# Tauri Multi-Platform Release Skill

This skill provides comprehensive guidance for releasing Tauri applications to multiple platforms (macOS, Windows, Linux) using GitHub Actions automation.

## Structure

```
tauri-multi-platform-release/
├── SKILL.md                    # Main skill documentation
├── README.md                   # This file
├── references/                 # Reference documentation
│   ├── build-artifacts.md      # Artifact types and details
│   ├── troubleshooting.md      # Common issues and solutions
│   └── quick-reference.md      # Quick commands and snippets
└── scripts/                    # Utility scripts
    ├── check-build.sh          # Verify build artifacts
    └── verify-tag.sh           # Validate release tags
```

## Quick Start

1. **Read the main skill**: `SKILL.md` contains all essential information
2. **Set up workflow**: Copy the GitHub Actions configuration
3. **Create release**: Use `scripts/release.sh` or manual process
4. **Verify builds**: Use `scripts/check-build.sh` to verify artifacts

## Key Features

### Automated Multi-Platform Builds
- macOS (Intel x64 and Apple Silicon aarch64)
- Windows (x64)
- Linux (AppImage and DEB)

### GitHub Actions Integration
- Parallel builds for faster execution
- Automatic release creation
- Artifact upload and management

### Version Management
- Automated version bumping
- Semantic versioning support
- CHANGELOG integration

### Code Signing Support
- macOS code signing and notarization
- Windows code signing
- Certificate management

## Usage

### For AI Assistants

When helping with Tauri releases:
1. Read `SKILL.md` for comprehensive guidance
2. Check `references/` for specific topics
3. Use `scripts/` for verification and automation

### For Developers

1. **Setup**: Follow `SKILL.md` Quick Start section
2. **Build**: Use build commands from `references/quick-reference.md`
3. **Release**: Create tags and push to trigger automation
4. **Troubleshoot**: Check `references/troubleshooting.md` for issues

## Scripts

### check-build.sh
Verifies all expected build artifacts are present:
```bash
./scripts/check-build.sh
```

### verify-tag.sh
Validates release tag before creating:
```bash
./scripts/verify-tag.sh v1.0.0
```

## Documentation

- **SKILL.md**: Complete skill documentation with examples
- **build-artifacts.md**: Detailed artifact information
- **troubleshooting.md**: Problem-solving guide
- **quick-reference.md**: Common commands and patterns

## Best Practices

1. Always update CHANGELOG.md before release
2. Test builds locally before pushing tags
3. Verify versions match in package.json and tauri.conf.json
4. Use semantic versioning consistently
5. Monitor GitHub Actions for build status

## Support

For issues or questions:
1. Check `references/troubleshooting.md`
2. Review GitHub Actions logs
3. Test locally with debug logging enabled
4. Consult Tauri documentation: https://tauri.app/v2/guides/

## License

This skill is part of the project and follows the same license.
