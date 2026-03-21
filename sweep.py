import os
import re

directory = '/Users/aadeshkhande/Documents/Professional/College/Datathon/src'

replacements = [
    # CSS variables
    (r'var\(--bg\)', 'var(--bg-base)'),
    (r'var\(--bg-primary\)', 'var(--bg-base)'),
    (r'var\(--surface\)', 'var(--bg-surface)'),
    (r'var\(--bg-secondary\)', 'var(--bg-raised)'),
    (r'var\(--primary\)', 'var(--violet)'),
    (r'var\(--border-v2\)', 'var(--border)'),
    # Class names
    (r'className="form-input"', 'className="input"'),
    (r'className="form-input ', 'className="input '),
    (r'className=\'form-input ', "className='input "),
    (r'className="form-label"', 'className="label"'),
    (r'className="form-label ', 'className="label '),
    (r'className="form-group"', 'style={{ marginBottom: 16 }}'),
    (r'className="form-group ', 'className="'), # strip form-group if it has other classes
    (r'className="text-muted"', 'className="text-secondary"'),
    (r'className="text-muted ', 'className="text-secondary '),
    (r'className="text-sm text-muted', 'className="text-secondary text-sm'),
    (r'center-page', 'auth-center'),
    # Emojis (just removing the specific ones to keep it clean, or replacing with a generic icon class if needed)
    (r'🎓\s*', ''),
    (r'🔑\s*', ''),
    (r'🛡️\s*', ''),
    (r'🏠\s*', ''),
    (r'💡\s*', ''),
    (r'📸\s*', ''),
    (r'🎤\s*', ''),
    (r'✅\s*', ''),
    (r'❌\s*', ''),
    (r'⚠️\s*', ''),
    (r'🔍\s*', ''),
    (r'🚀\s*', ''),
    (r'📋\s*', ''),
    (r'👋\s*', ''),
    (r'🚪\s*', ''),
    (r'📅\s*', ''),
    (r'📢\s*', ''),
    (r'📊\s*', ''),
    (r'📱\s*', ''),
    (r'🏢\s*', ''),
]

def sweep_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    new_content = content
    for old, new in replacements:
        new_content = re.sub(old, new, new_content)

    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

for root, _, files in os.walk(directory):
    for f in files:
        if f.endswith('.jsx') or f.endswith('.js'):
            sweep_file(os.path.join(root, f))
