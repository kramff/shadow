echo "pushing a git commit."
$commit = Read-Host -Prompt "what to put in the commit message? "
git add .
git commit -m $commit
git push

echo "sshing into website and pull the new commit"

echo "done sshing into website"

$resetserver = Read-Host -Prompt "does the server need to be reset? (y/n)"

