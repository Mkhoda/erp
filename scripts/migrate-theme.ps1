# Theme Migration Script
# این اسکریپت به صورت خودکار کلاس‌های قدیمی را با کلاس‌های جدید جایگزین می‌کند

$files = Get-ChildItem -Path "apps/frontend/app/dashboard" -Filter "*.tsx" -Recurse

$replacements = @{
    # Backgrounds
    'bg-white/70 dark:bg-gray-900/70' = 'bg-theme-card'
    'bg-white dark:bg-gray-900' = 'bg-theme-primary'
    'bg-gray-50 dark:bg-gray-800' = 'bg-theme-secondary'
    'bg-gray-100 dark:bg-gray-800' = 'bg-theme-tertiary'
    'hover:bg-gray-100 dark:hover:bg-gray-800' = 'bg-theme-hover'
    'hover:bg-gray-50 dark:hover:bg-gray-800' = 'bg-theme-hover'
    
    # Text Colors
    'text-gray-900 dark:text-gray-100' = 'text-theme-primary'
    'text-gray-600 dark:text-gray-400' = 'text-theme-secondary'
    'text-gray-500 dark:text-gray-400' = 'text-theme-muted'
    
    # Borders
    'border border-gray-200/50 dark:border-gray-700/50' = 'border border-theme'
    'border-gray-200 dark:border-gray-700' = 'border-theme'
    'border-gray-100 dark:border-gray-800' = 'border-theme-light'
    'border-gray-300 dark:border-gray-600' = 'border-theme-strong'
    
    # Shadows
    'shadow-sm' = 'shadow-theme'
    'shadow-lg' = 'shadow-theme-lg'
}

$totalReplacements = 0

foreach ($file in $files) {
    Write-Host "Processing: $($file.FullName)" -ForegroundColor Cyan
    
    $content = Get-Content -Path $file.FullName -Raw
    $originalContent = $content
    $fileReplacements = 0
    
    foreach ($old in $replacements.Keys) {
        $new = $replacements[$old]
        $matches = [regex]::Matches($content, [regex]::Escape($old))
        
        if ($matches.Count -gt 0) {
            Write-Host "  Replacing: $old → $new ($($matches.Count) times)" -ForegroundColor Yellow
            $content = $content -replace [regex]::Escape($old), $new
            $fileReplacements += $matches.Count
        }
    }
    
    if ($originalContent -ne $content) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        Write-Host "  ✅ Updated with $fileReplacements replacements" -ForegroundColor Green
        $totalReplacements += $fileReplacements
    } else {
        Write-Host "  ℹ️  No changes needed" -ForegroundColor Gray
    }
}

Write-Host "`n========================================" -ForegroundColor Magenta
Write-Host "Migration Complete!" -ForegroundColor Green
Write-Host "Total files processed: $($files.Count)" -ForegroundColor Cyan
Write-Host "Total replacements: $totalReplacements" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Magenta
