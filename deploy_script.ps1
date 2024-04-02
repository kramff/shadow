git ls-files -m | Tee-Object -Variable ChangedFiles

if ($ChangedFiles.Length -gt 0) {
	echo "Changed files - pushing to git"
	$commit_msg = Read-Host -Prompt "what to put in the commit message? "
	git add .
	git commit -m $commit_msg
	git push
}

$DeployGame = Read-Host -Prompt "Deploy game? y/n"

if ($DeployGame -eq "y") {
	cd Game
	npx vite build
	Copy-Item -Path "models" -Destination "dist" -Recurse
	#At this point, need to copy dist over to website using sftp
	echo "copy dist\ to website..."
	cd ..
}

$DeployServer = Read-Host -Prompt "Deploy server? y/n"

if ($DeployServer -eq "y") {
	#Here, need to ssh into server and pull the new commit, and then re-start the server
	echo "ssh into server..."
}

