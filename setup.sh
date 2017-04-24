cd /usr/src/app

for dir in /usr/src/vendor/* ; do
  if [[ -d $dir ]]; then
    echo "Manually linking $dir"
    dir_name=$(basename $dir)
    rm -rf /usr/src/app/node_modules/$dir_name
    cp -rp $dir /usr/src/app/node_modules/$dir_name
  fi

  echo "Rebuilding linked modules"
  npm rebuild
done

/bin/bash -c -- "$@"
