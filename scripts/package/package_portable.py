#!/usr/bin/env python3
from __future__ import annotations

# Allow direct execution from nested scripts/ folders.
import sys
from pathlib import Path
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

import shutil
import subprocess

from pf_rag.version import APP_NAME, APP_RELEASE_NAME, APP_VERSION


ROOT = Path(__file__).resolve().parents[2]
DIST_DIR = ROOT / "dist"
BUILD_OUTPUT_DIR = DIST_DIR / APP_NAME
PORTABLE_DIR = DIST_DIR / f"{APP_RELEASE_NAME}_portable"
ZIP_BASENAME = DIST_DIR / f"{APP_RELEASE_NAME}_portable"
COLLECT_ALL_PACKAGES = [
    "chromadb",
    "onnxruntime",
    "posthog",
    "pypika",
    "tokenizers",
]


def run(cmd: list[str]) -> None:
    print(">", " ".join(cmd))
    subprocess.run(cmd, cwd=ROOT, check=True)


def clean_outputs() -> None:
    for path in [BUILD_OUTPUT_DIR, PORTABLE_DIR]:
        if path.exists():
            shutil.rmtree(path, ignore_errors=True)

    zip_path = ZIP_BASENAME.with_suffix(".zip")
    if zip_path.exists():
        zip_path.unlink()


def build_exe() -> None:
    excludes = [
        "sentence_transformers",
        "transformers",
        "torch",
        "torchvision",
        "torchaudio",
        "tensorflow",
        "datasets",
        "faiss",
        "cv2",
        "matplotlib",
        "pandas",
        "scipy",
        "sklearn",
        "PyQt5",
        "notebook",
        "jupyter",
        "IPython",
    ]

    collect_args: list[str] = []
    for package_name in COLLECT_ALL_PACKAGES:
        collect_args.extend(["--collect-all", package_name])

    cmd = [
        "pyinstaller",
        "--noconfirm",
        "--clean",
        "--onedir",
        "--console",
        "--name",
        APP_NAME,
        *collect_args,
        "run_web.py",
    ]
    for module_name in excludes:
        cmd.extend(["--exclude-module", module_name])

    run(cmd)


def copy_if_exists(src: Path, dst: Path) -> None:
    if src.exists():
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)


def copy_runtime_assets(target_dir: Path) -> None:
    shutil.copytree(ROOT / "web", target_dir / "web")

    result_src = ROOT / "result"
    result_dst = target_dir / "result"
    result_dst.mkdir(parents=True, exist_ok=True)

    copied_sources = 0
    for source_dir in sorted(path for path in result_src.iterdir() if path.is_dir()):
        code = source_dir.name
        raw_spell = source_dir / f"spells-{code}.json"
        model_spell = source_dir / f"spells-{code}-model.json"
        if raw_spell.exists() or model_spell.exists():
            dst_dir = result_dst / code
            dst_dir.mkdir(parents=True, exist_ok=True)
            copy_if_exists(raw_spell, dst_dir / raw_spell.name)
            copy_if_exists(model_spell, dst_dir / model_spell.name)
            copied_sources += 1

    copy_if_exists(
        result_src / "feats" / "feats-frontend.json",
        result_dst / "feats" / "feats-frontend.json",
    )
    copy_if_exists(
        result_src / "classes" / "classes-extracted.json",
        result_dst / "classes" / "classes-extracted.json",
    )
    copy_if_exists(
        result_src / "items" / "wondrous-items.json",
        result_dst / "items" / "wondrous-items.json",
    )

    data_dst = target_dir / "data"
    data_dst.mkdir(parents=True, exist_ok=True)
    if (ROOT / "data" / "chroma_db").exists():
        shutil.copytree(ROOT / "data" / "chroma_db", data_dst / "chroma_db")
    if (ROOT / "data" / "bm25_index").exists():
        shutil.copytree(ROOT / "data" / "bm25_index", data_dst / "bm25_index")
    copy_if_exists(ROOT / "data" / "aon_source_counts.json", data_dst / "aon_source_counts.json")

    print(f"Copied spell sources: {copied_sources}")


def write_portable_helpers(target_dir: Path) -> None:
    start_bat = target_dir / "start.bat"
    start_bat.write_text(
        "@echo off\n"
        "cd /d \"%~dp0\"\n"
        f"{APP_NAME}.exe\n",
        encoding="utf-8",
    )

    install_bat = target_dir / "install.bat"
    install_bat.write_text(
        "@echo off\n"
        "setlocal\n"
        f"set \"APP_DIR=%LOCALAPPDATA%\\{APP_NAME}\"\n"
        f"echo Installing {APP_RELEASE_NAME} to %APP_DIR% ...\n"
        "if not exist \"%APP_DIR%\" mkdir \"%APP_DIR%\"\n"
        "robocopy \"%~dp0\" \"%APP_DIR%\" /E /XF install.bat >nul\n"
        "powershell -NoProfile -ExecutionPolicy Bypass -Command "
        "\"$desktop=[Environment]::GetFolderPath('Desktop'); "
        "$shortcut=(New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $desktop 'pathfinder_tools.lnk')); "
        f"$shortcut.TargetPath=(Join-Path $env:LOCALAPPDATA '{APP_NAME}\\start.bat'); "
        f"$shortcut.WorkingDirectory=(Join-Path $env:LOCALAPPDATA '{APP_NAME}'); "
        "$shortcut.Save()\"\n"
        "echo Done. Starting pathfinder_tools ...\n"
        "start \"\" \"%APP_DIR%\\start.bat\"\n",
        encoding="utf-8",
    )

    config_dir = target_dir / "config"
    config_dir.mkdir(parents=True, exist_ok=True)
    env_example = config_dir / "app.env.example"
    env_example.write_text(
        "# Copy this file to config/app.env and fill in your own keys if needed.\n"
        "LLM_API_KEY=\n"
        "LLM_BASE_URL=https://api.siliconflow.cn/v1\n"
        "LLM_MODEL=deepseek-ai/DeepSeek-V3.2\n"
        "LLM_TIMEOUT=120\n"
        "\n"
        "EMBEDDING_API_KEY=\n"
        "EMBEDDING_BASE_URL=https://api.siliconflow.cn/v1\n"
        "EMBEDDING_MODEL=BAAI/bge-large-zh-v1.5\n",
        encoding="utf-8",
    )

    readme = target_dir / "README_PORTABLE.txt"
    readme.write_text(
        f"{APP_RELEASE_NAME} portable package\n\n"
        "Usage:\n"
        f"1. Double-click install.bat to install to %LOCALAPPDATA%\\{APP_NAME} and create a desktop shortcut.\n"
        f"2. Or double-click start.bat / {APP_NAME}.exe to run directly from this folder.\n"
        "3. The app opens http://localhost:<port>/web/ automatically.\n"
        "4. Smart Q&A asks for an API key in the frontend. No key is bundled in this package.\n"
        "5. Optional local config: copy config/app.env.example to config/app.env.\n\n"
        "Included modules:\n"
        "- Spell search and smart Q&A\n"
        "- Feat search\n"
        "- Class browser\n"
        "- Wondrous item browser\n"
        "- Character workbench\n"
        "- Character status tracker\n",
        encoding="utf-8",
    )


def build_portable_dir() -> None:
    if not BUILD_OUTPUT_DIR.exists():
        raise FileNotFoundError(f"Build output not found: {BUILD_OUTPUT_DIR}")
    if PORTABLE_DIR.exists():
        shutil.rmtree(PORTABLE_DIR, ignore_errors=True)
    shutil.copytree(BUILD_OUTPUT_DIR, PORTABLE_DIR)
    copy_runtime_assets(PORTABLE_DIR)
    write_portable_helpers(PORTABLE_DIR)


def make_zip() -> Path:
    return Path(
        shutil.make_archive(
            base_name=str(ZIP_BASENAME),
            format="zip",
            root_dir=str(DIST_DIR),
            base_dir=PORTABLE_DIR.name,
        )
    )


def main() -> None:
    clean_outputs()
    build_exe()
    build_portable_dir()
    zip_path = make_zip()

    print("\nPackage complete:")
    print(f"- Portable directory: {PORTABLE_DIR}")
    print(f"- Zip package:        {zip_path}")


if __name__ == "__main__":
    main()
