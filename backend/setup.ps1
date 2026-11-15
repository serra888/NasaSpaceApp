[CmdletBinding()]
param(
    [string]$PythonExecutable,
    [string]$VenvDirectory = ".venv"
)

$ErrorActionPreference = "Stop"

function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed: $Program $($Arguments -join ' ')"
    }
}

Push-Location $PSScriptRoot
try {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw "Install and start Docker Desktop with Linux containers, then retry."
    }
    Invoke-Checked -Program "docker" -Arguments @("info", "--format", "{{.ServerVersion}}")
    Invoke-Checked -Program "docker" -Arguments @("compose", "version")

    $pythonArguments = @()
    if ($PythonExecutable) {
        $basePython = $PythonExecutable
    } elseif (Get-Command py -ErrorAction SilentlyContinue) {
        $basePython = "py"
        $pythonArguments = @("-3.12")
    } elseif (Get-Command python -ErrorAction SilentlyContinue) {
        $basePython = "python"
    } else {
        throw "Install x64 CPython 3.12 with the Python launcher, reopen PowerShell, and retry."
    }

    $versionCheck = "import platform, struct, sys; sys.exit(0 if sys.version_info[:2] == (3, 12) and struct.calcsize('P') == 8 and platform.python_implementation() == 'CPython' else 1)"
    & $basePython @pythonArguments -c $versionCheck
    if ($LASTEXITCODE -ne 0) {
        throw "x64 CPython 3.12 is required. Install it or pass -PythonExecutable 'C:\path\to\python.exe'."
    }

    if ([System.IO.Path]::IsPathRooted($VenvDirectory)) {
        $venvRoot = [System.IO.Path]::GetFullPath($VenvDirectory)
    } else {
        $venvRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot $VenvDirectory))
    }
    $venvPython = Join-Path $venvRoot "Scripts\python.exe"
    if ((Test-Path $venvRoot) -and -not (Test-Path $venvPython)) {
        throw "The environment directory is not a Windows venv. Use a separate checkout or pass -VenvDirectory .windows-check\venv."
    }
    if (-not (Test-Path $venvPython)) {
        Invoke-Checked -Program $basePython -Arguments ($pythonArguments + @("-m", "venv", $venvRoot))
    }
    Invoke-Checked -Program $venvPython -Arguments @("-c", $versionCheck)
    Invoke-Checked -Program $venvPython -Arguments @("-m", "pip", "install", "--upgrade", "pip")
    Invoke-Checked -Program $venvPython -Arguments @("-m", "pip", "install", "-r", "requirements.lock")
    Invoke-Checked -Program $venvPython -Arguments @("-m", "pip", "check")

    if (-not (Test-Path ".env")) {
        Copy-Item ".env.example" ".env"
    }
    Invoke-Checked -Program "docker" -Arguments @("compose", "up", "-d", "--wait")
    Invoke-Checked -Program $venvPython -Arguments @("-m", "alembic", "upgrade", "head")
    Invoke-Checked -Program $venvPython -Arguments @("-m", "app.seed")

    Write-Host "Orbiton setup completed. From the backend directory, start the API:"
    Write-Host "& '$venvPython' -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
    Write-Host "In another terminal, start the simulator:"
    Write-Host "& '$venvPython' -m app.simulator"
    Write-Host "API reference: http://localhost:8000/docs"
} catch {
    Write-Host "Setup stopped: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "See backend/README.md for Python, Docker and PostgreSQL port troubleshooting."
    exit 1
} finally {
    Pop-Location
}
