set -ex

PACKAGE_NAME=$1
TEMPLATE=.module-templates/$2

SCRIPTDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
TARGET=packages/$PACKAGE_NAME

pushd $SCRIPTDIR/..

mkdir $TARGET
cp -R -n $TEMPLATE/. $TARGET

for i in `find $TARGET -type f`; do
    sed -i '' "s/templatetemplate/$PACKAGE_NAME/g" "$i"
done

REPLACE_IN_FILES=`find $TARGET -name '*templatetemplate*' | awk '{str=$0;gsub("templatetemplate", "$PACKAGE_NAME", str); print "mv", $0, str}'`
eval "$REPLACE_IN_FILES"

popd
