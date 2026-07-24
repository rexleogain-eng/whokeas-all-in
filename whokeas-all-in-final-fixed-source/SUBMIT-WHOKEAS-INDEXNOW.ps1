# SUBMIT-WHOKEAS-INDEXNOW.ps1
# Run this only after the Vercel deployment containing the SEO package is Ready.

$ErrorActionPreference = "Stop"
$siteUrl = "https://whokeas.store"
$hostName = "whokeas.store"
$key = "0ac180c9a8c34b58a8b6f2fd432aa545"
$keyLocation = "$siteUrl/$key.txt"

Write-Host "
READING LIVE WHOKEAS SITEMAP..." -ForegroundColor Cyan
[xml]$sitemap = (Invoke-WebRequest -Uri "$siteUrl/sitemap.xml" -UseBasicParsing).Content

$urls = @($sitemap.urlset.url | ForEach-Object {
    [string]$_.loc
}) | Where-Object { $_ } | Select-Object -Unique

if ($urls.Count -eq 0) {
    throw "No URLs were found in the live sitemap."
}

$payload = @{
    host = $hostName
    key = $key
    keyLocation = $keyLocation
    urlList = $urls
} | ConvertTo-Json -Depth 5

Write-Host "SUBMITTING $($urls.Count) URLS TO INDEXNOW..." -ForegroundColor Cyan

Invoke-RestMethod 
    -Method Post 
    -Uri "https://api.indexnow.org/indexnow" 
    -ContentType "application/json; charset=utf-8" 
    -Body $payload

Write-Host "
INDEXNOW SUBMISSION ACCEPTED." -ForegroundColor Green