# save as gitpush.ps1
param(
    [string]$message = "update"
)

git add .
git commit -m $message
git push origin master
gh workflow run ci-full-game.yml --ref master