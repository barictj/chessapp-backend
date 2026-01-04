# save as gitpush.ps1
param(
    [string]$message = "update"
)

git add .
git commit -m $message
git push origin master
