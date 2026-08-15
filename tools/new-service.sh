#!/usr/bin/env bash
set -Eeuo pipefail

name="${1:-}"
base_package="${2:-}"

if [[ ! "$name" =~ ^[a-z][a-z0-9-]{2,39}$ ]]; then
  echo "Usage: $0 <kebab-service-name> <base.package>" >&2
  exit 2
fi
if [[ ! "$base_package" =~ ^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$ ]]; then
  echo "Invalid base package: $base_package" >&2
  exit 2
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
template_root="$repo_root/templates/service-template"
destination="$repo_root/services/$name"

if [[ -e "$destination" ]]; then
  echo "Service already exists: $destination" >&2
  exit 1
fi

class_name=""
IFS='-' read -ra parts <<< "$name"
for part in "${parts[@]}"; do
  class_name+="${part^}"
done
package_path="${base_package//./\/}"

cp -R "$template_root" "$destination"
for source_set in main test; do
  java_root="$destination/src/$source_set/java"
  mkdir -p "$(dirname "$java_root/$package_path")"
  mv "$java_root/__PACKAGE_PATH__" "$java_root/$package_path"
done

while IFS= read -r -d '' file; do
  sed -i.bak \
    -e "s/__SERVICE_NAME__/$name/g" \
    -e "s/__BASE_PACKAGE__/$base_package/g" \
    -e "s/__CLASS_NAME__/$class_name/g" \
    "$file"
  rm -f "$file.bak"
done < <(find "$destination" -type f -print0)

find "$destination" -type f -name '*__CLASS_NAME__*' -print0 | while IFS= read -r -d '' file; do
  mv "$file" "${file/__CLASS_NAME__/$class_name}"
done

echo "Created services/$name"
echo "Run: ./gradlew :services:$name:test"
