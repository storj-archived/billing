#!/bin/bash
cd /opt/app

for dir in /usr/src/vendor/* ; do
  if [[ -d $dir ]]; then
    echo "Manually linking $dir"
    dir_name=$(basename $dir)
    rm -rf /opt/app/node_modules/$dir_name
    cp -rp $dir /opt/app/node_modules/$dir_name
  fi

  echo "Rebuilding linked modules"
  npm rebuild
done

/bin/bash -c -- "$@"
