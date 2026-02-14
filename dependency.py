#!/usr/bin/env python3
"""
RideHaul APK Build Dependency Manager
Handles setup, prebuild, and compilation of the Expo ride-hailing app
"""

import os
import subprocess
import sys
import shutil
import json
from pathlib import Path

class BuildManager:
    def __init__(self):
        self.project_root = Path(__file__).parent
        self.android_dir = self.project_root / "android"
        self.build_output_dir = self.android_dir / "app" / "build" / "outputs"

    def run_command(self, command, cwd=None, shell=True):
        """Execute a shell command and return success status"""
        print(f"\n{'='*60}")
        print(f"Executing: {command}")
        print(f"{'='*60}\n")
        
        try:
            process = subprocess.Popen(
                command,
                shell=shell,
                cwd=cwd or self.project_root,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True
            )
            
            for line in process.stdout:
                print(line, end='')
            
            process.wait()
            
            if process.returncode != 0:
                print(f"\n❌ Command failed with return code {process.returncode}")
                return False
            
            print(f"\n✅ Command completed successfully")
            return True
        except Exception as e:
            print(f"❌ Error executing command: {e}")
            return False

    def check_requirements(self):
        """Check if all required tools are installed"""
        print("\n📋 Checking requirements...\n")
        
        requirements = {
            "node": "node --version",
            "npm": "npm --version",
            "pnpm": "pnpm --version",
            "java": "java -version",
            "gradle": "gradle --version",
        }
        
        missing = []
        for tool, cmd in requirements.items():
            try:
                result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
                if result.returncode == 0:
                    print(f"✅ {tool}: {result.stdout.split(chr(10))[0]}")
                else:
                    missing.append(tool)
            except:
                missing.append(tool)
        
        if missing:
            print(f"\n❌ Missing requirements: {', '.join(missing)}")
            print("\nPlease install the missing tools and try again.")
            return False
        
        print("\n✅ All requirements met!")
        return True

    def setup_environment(self):
        """Install dependencies"""
        print("\n🔧 Setting up environment...\n")
        
        if not self.run_command("pnpm install"):
            return False
        
        print("\n✅ Environment setup complete!")
        return True

    def prebuild(self):
        """Generate native Android project"""
        print("\n🏗️  Generating native Android project...\n")
        
        if not self.run_command("npx expo prebuild --clean"):
            return False
        
        print("\n✅ Prebuild complete!")
        return True

    def build_debug(self):
        """Build debug APK"""
        print("\n📦 Building debug APK...\n")
        
        if not self.android_dir.exists():
            print("❌ Android directory not found. Run prebuild first.")
            return False
        
        # Make gradlew executable
        gradlew_path = self.android_dir / "gradlew"
        if gradlew_path.exists():
            os.chmod(gradlew_path, 0o755)
        
        if not self.run_command("./gradlew assembleDebug", cwd=self.android_dir):
            return False
        
        # Check if APK was created
        debug_apk = self.build_output_dir / "apk" / "debug" / "app-debug.apk"
        if debug_apk.exists():
            print(f"\n✅ Debug APK created: {debug_apk}")
            return True
        else:
            print(f"\n❌ Debug APK not found at {debug_apk}")
            return False

    def build_release(self):
        """Build release APK and AAB"""
        print("\n📦 Building release APK and AAB...\n")
        
        if not self.android_dir.exists():
            print("❌ Android directory not found. Run prebuild first.")
            return False
        
        # Make gradlew executable
        gradlew_path = self.android_dir / "gradlew"
        if gradlew_path.exists():
            os.chmod(gradlew_path, 0o755)
        
        # Build release APK
        if not self.run_command("./gradlew assembleRelease", cwd=self.android_dir):
            return False
        
        # Build AAB
        if not self.run_command("./gradlew bundleRelease", cwd=self.android_dir):
            return False
        
        # Check outputs
        release_apk = self.build_output_dir / "apk" / "release" / "app-release.apk"
        release_aab = self.build_output_dir / "bundle" / "release" / "app-release.aab"
        
        success = True
        if release_apk.exists():
            print(f"\n✅ Release APK created: {release_apk}")
        else:
            print(f"\n⚠️  Release APK not found at {release_apk}")
            success = False
        
        if release_aab.exists():
            print(f"✅ Release AAB created: {release_aab}")
        else:
            print(f"⚠️  Release AAB not found at {release_aab}")
        
        return success

    def clean(self):
        """Clean build artifacts"""
        print("\n🧹 Cleaning build artifacts...\n")
        
        if self.android_dir.exists():
            if not self.run_command("./gradlew clean", cwd=self.android_dir):
                print("⚠️  Gradle clean failed, continuing...")
        
        # Remove node_modules and lock files if needed
        print("✅ Clean complete!")
        return True

    def build_all(self):
        """Complete build process"""
        print("\n🚀 Starting complete build process...\n")
        
        steps = [
            ("Check requirements", self.check_requirements),
            ("Setup environment", self.setup_environment),
            ("Prebuild", self.prebuild),
            ("Build debug APK", self.build_debug),
        ]
        
        for step_name, step_func in steps:
            print(f"\n{'='*60}")
            print(f"Step: {step_name}")
            print(f"{'='*60}")
            
            if not step_func():
                print(f"\n❌ Build failed at step: {step_name}")
                return False
        
        print(f"\n{'='*60}")
        print("✅ BUILD COMPLETE!")
        print(f"{'='*60}\n")
        
        return True

def main():
    if len(sys.argv) < 2:
        print("""
Usage: python3 dependency.py <command>

Commands:
  check      - Check if all requirements are installed
  setup      - Install dependencies
  prebuild   - Generate native Android project
  debug      - Build debug APK
  release    - Build release APK and AAB
  clean      - Clean build artifacts
  all        - Complete build process (check + setup + prebuild + debug)

Examples:
  python3 dependency.py check
  python3 dependency.py setup
  python3 dependency.py all
  python3 dependency.py release
        """)
        return 1
    
    manager = BuildManager()
    command = sys.argv[1].lower()
    
    commands = {
        "check": manager.check_requirements,
        "setup": manager.setup_environment,
        "prebuild": manager.prebuild,
        "debug": manager.build_debug,
        "release": manager.build_release,
        "clean": manager.clean,
        "all": manager.build_all,
    }
    
    if command not in commands:
        print(f"❌ Unknown command: {command}")
        return 1
    
    success = commands[command]()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
