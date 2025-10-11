#!/usr/bin/env python3
"""
AI.duino Locale Update Script
Updates locale JSON files with new translations from add_*.json files
Usage: python update_locales.py add_it.json
"""

import json
import sys
import os
from pathlib import Path
from collections import OrderedDict


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


def main():
    if len(sys.argv) != 2:
        print("Usage: python update_locales.py add_<locale>.json")
        print("Example: python update_locales.py add_it.json")
        sys.exit(1)
    
    update_file = sys.argv[1]
    
    # Check if update file exists (in current directory)
    if not os.path.exists(update_file):
        print(f"❌ Error: File '{update_file}' not found in current directory")
        sys.exit(1)
    
    # Extract locale code
    locale = extract_locale_from_filename(update_file)
    if not locale:
        print(f"❌ Error: Filename must be in format 'add_<locale>.json'")
        print(f"   Example: add_it.json, add_fr.json, add_es.json")
        sys.exit(1)
    
    # Determine target file in locales/ subdirectory
    locales_dir = "locales"
    target_file = os.path.join(locales_dir, f"{locale}.json")
    
    # Check if locales directory exists
    if not os.path.isdir(locales_dir):
        print(f"❌ Error: Directory '{locales_dir}/' not found")
        print(f"   Make sure you're in the project root directory")
        sys.exit(1)
    
    # Check if target file exists
    if not os.path.exists(target_file):
        print(f"❌ Error: Target file '{target_file}' not found")
        print(f"   Available locales in {locales_dir}/:")
        for f in os.listdir(locales_dir):
            if f.endswith('.json'):
                print(f"   • {f}")
        sys.exit(1)
    
    print(f"🔄 Updating {target_file} with translations from {update_file}...")
    
    try:
        # Load files
        target_data = load_json(target_file)
        update_data = load_json(update_file)
        
        # Merge updates into target
        added_keys = merge_recursive(target_data, update_data)
        
        # Save updated target
        save_json(target_file, target_data)
        
        # Print summary
        print(f"\n✅ Successfully updated {target_file}")
        print(f"📝 Added/Updated {len(added_keys)} key(s):")
        for key in added_keys:
            print(f"   • {key}")
        
        print(f"\n💡 You can now delete {update_file} if all translations look correct")
        
    except json.JSONDecodeError as e:
        print(f"❌ JSON Error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
