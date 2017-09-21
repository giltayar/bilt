set -ex

PACKAGE_NAME=$1
TEMPLATE=.module-templates/$2

SCRIPTDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
TARGET=packages/$PACKAGE_NAME

pushd $SCRIPTDIR/..

mkdir $TARGET
cp -R -n $TEMPLATE $TARGET

for i in `find $TARGET -type f`; do
    sed -i '' "s/templatetemplate/$PACKAGE_NAME/g" "$i"
done

mv $TARGET/scripts/run-templatetemplate.js $TARGET/scripts/run-$PACKAGE_NAME.js
mv $TARGET/src/templatetemplate.js $TARGET/src/$PACKAGE_NAME.js

popd
