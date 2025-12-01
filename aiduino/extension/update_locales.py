#!/usr/bin/env python3
"""
AI.duino Locale Update Script
Updates locale JSON files with new translations from add_*.json files
Usage: 
  python update_locales.py              # Process all add_*.json files
  python update_locales.py add_it.json  # Process specific file
"""

import json
import sys
import os
from pathlib import Path
from collections import OrderedDict
import glob


def load_json(filepath):
    """Load JSON file preserving order"""
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f, object_pairs_hook=OrderedDict)


def save_json(filepath, data):
    """Save JSON file with proper formatting"""
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')  # Add trailing newline


def merge_recursive(target, updates, path=""):
    """Recursively merge updates into target, preserving order"""
    added_keys = []
    
    for key, value in updates.items():
        current_path = f"{path}.{key}" if path else key
        
        if key not in target:
            # New key - add it
            target[key] = value
            added_keys.append(current_path)
        elif isinstance(value, dict) and isinstance(target[key], dict):
            # Both are dicts - recurse
            nested_keys = merge_recursive(target[key], value, current_path)
            added_keys.extend(nested_keys)
        else:
            # Key exists but is not a dict or types differ - replace
            target[key] = value
            added_keys.append(f"{current_path} (updated)")
    
    return added_keys


def extract_locale_from_filename(filename):
    """Extract locale code from filename like 'add_it.json' -> 'it'"""
    basename = os.path.basename(filename)
    if basename.startswith('add_') and basename.endswith('.json'):
        return basename[4:-5]  # Remove 'add_' and '.json'
    return None


def process_file(update_file, locales_dir="locales"):
    """Process a single add_*.json file"""
    # Extract locale code
    locale = extract_locale_from_filename(update_file)
    if not locale:
        return False, f"Invalid filename format: {update_file}"
    
    # Determine target file in locales/ subdirectory
    target_file = os.path.join(locales_dir, f"{locale}.json")
    
    # Check if target file exists
    if not os.path.exists(target_file):
        return False, f"Target file '{target_file}' not found"
    
    try:
        # Load files
        target_data = load_json(target_file)
        update_data = load_json(update_file)
        
        # Merge updates into target
        added_keys = merge_recursive(target_data, update_data)
        
        # Save updated target
        save_json(target_file, target_data)
        
        return True, {
            'target': target_file,
            'keys': added_keys
        }
        
    except json.JSONDecodeError as e:
        return False, f"JSON Error in {update_file}: {e}"
    except Exception as e:
        return False, f"Error processing {update_file}: {e}"


def main():
    locales_dir = "locales"
    
    # Check if locales directory exists
    if not os.path.isdir(locales_dir):
        print(f"❌ Error: Directory '{locales_dir}/' not found")
        print(f"   Make sure you're in the project root directory")
        sys.exit(1)
    
    # Determine which files to process
    if len(sys.argv) == 2:
        # Single file mode
        update_files = [sys.argv[1]]
        if not os.path.exists(update_files[0]):
            print(f"❌ Error: File '{update_files[0]}' not found")
            sys.exit(1)
    else:
        # Batch mode - find all add_*.json files
        update_files = sorted(glob.glob("add_*.json"))
        if not update_files:
            print("❌ No add_*.json files found in current directory")
            print("\nUsage:")
            print("  python update_locales.py              # Process all add_*.json files")
            print("  python update_locales.py add_it.json  # Process specific file")
            sys.exit(1)
    
    print(f"🔄 Processing {len(update_files)} file(s)...")
    print("=" * 60)
    
    results = []
    for update_file in update_files:
        success, result = process_file(update_file, locales_dir)
        results.append((update_file, success, result))
        
        if success:
            print(f"\n✅ {update_file} → {result['target']}")
            print(f"   Updated {len(result['keys'])} key(s)")
        else:
            print(f"\n❌ {update_file}: {result}")
    
    # Summary
    print("\n" + "=" * 60)
    successful = sum(1 for _, success, _ in results if success)
    failed = len(results) - successful
    
    print(f"\n📊 Summary:")
    print(f"   ✅ Successful: {successful}")
    if failed > 0:
        print(f"   ❌ Failed: {failed}")
    
    total_keys = sum(len(r['keys']) for _, success, r in results if success)
    print(f"   🔑 Total keys updated: {total_keys}")
    
    if successful > 0:
        print(f"\n💡 You can now delete the add_*.json files if everything looks correct")
        print(f"   Command: rm add_*.json")


if __name__ == "__main__":
    main()
