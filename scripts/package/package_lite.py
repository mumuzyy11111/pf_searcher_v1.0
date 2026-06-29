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
import time

from pf_rag.version import APP_NAME as PROJECT_APP_NAME
from pf_rag.version import APP_RELEASE_NAME, APP_VERSION


ROOT = Path(__file__).resolve().parents[2]
DIST_DIR = ROOT / "dist"
APP_NAME = f"{PROJECT_APP_NAME}_lite"
BUILD_OUTPUT_DIR = DIST_DIR / APP_NAME
PORTABLE_DIR = DIST_DIR / f"{PROJECT_APP_NAME}_lite_v{APP_VERSION}_portable"
ZIP_BASENAME = DIST_DIR / f"{PROJECT_APP_NAME}_lite_v{APP_VERSION}_portable"
BUILD_ROOT = ROOT / "build"
BUILD_WORK_DIR = BUILD_ROOT / f"{APP_NAME}_work"
GENERATED_SPEC = ROOT / f"{APP_NAME}.spec"


def run(cmd: list[str]) -> None:
    print(">", " ".join(cmd))
    subprocess.run(cmd, cwd=ROOT, check=True)


def remove_empty_build_root() -> None:
    if BUILD_ROOT.exists() and not any(BUILD_ROOT.iterdir()):
        BUILD_ROOT.rmdir()


def remove_tree(path: Path) -> None:
    for attempt in range(5):
        if not path.exists():
            return
        shutil.rmtree(path, ignore_errors=True)
        if not path.exists():
            return
        time.sleep(0.2 * (attempt + 1))


def clean_outputs() -> None:
    for path in [BUILD_OUTPUT_DIR, PORTABLE_DIR]:
        if path.exists():
            remove_tree(path)

    zip_path = ZIP_BASENAME.with_suffix(".zip")
    if zip_path.exists():
        zip_path.unlink()

    if BUILD_WORK_DIR.exists():
        remove_tree(BUILD_WORK_DIR)
    remove_empty_build_root()

    if GENERATED_SPEC.exists():
        GENERATED_SPEC.unlink()


def build_exe() -> None:
    excludes = [
        "chromadb",
        "onnxruntime",
        "openai",
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
        "numpy",
        "pandas",
        "scipy",
        "sklearn",
        "tokenizers",
        "posthog",
        "pypika",
        "jieba",
        "rank_bm25",
        "requests",
        "bs4",
        "PyQt5",
        "notebook",
        "jupyter",
        "IPython",
    ]

    cmd = [
        "pyinstaller",
        "--noconfirm",
        "--clean",
        "--onedir",
        "--console",
        "--workpath",
        str(BUILD_WORK_DIR),
        "--distpath",
        str(DIST_DIR),
        "--name",
        APP_NAME,
        "run_lite.py",
    ]
    for module_name in excludes:
        cmd.extend(["--exclude-module", module_name])

    run(cmd)


def copy_if_exists(src: Path, dst: Path) -> None:
    if src.exists():
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)


def copy_lite_web(target_dir: Path) -> None:
    web_dst = target_dir / "web"
    shutil.copytree(ROOT / "web", web_dst)

    script_path = web_dst / "assets" / "js" / "spell-rag.js"
    if script_path.exists():
        text = script_path.read_text(encoding="utf-8")
        text = text.replace("modeSelect.value = 'rag';", "modeSelect.value = 'name';")
        script_path.write_text(text, encoding="utf-8")


def copy_runtime_assets(target_dir: Path) -> None:
    copy_lite_web(target_dir)

    result_src = ROOT / "result"
    result_dst = target_dir / "result"
    result_dst.mkdir(parents=True, exist_ok=True)

    copied_sources = 0
    for source_dir in sorted(path for path in result_src.iterdir() if path.is_dir()):
        code = source_dir.name
        if code.lower() == "index":
            continue
        raw_spell = source_dir / f"spells-{code}.json"
        model_spell = source_dir / f"spells-{code}-model.json"
        chosen = raw_spell if raw_spell.exists() else model_spell
        if chosen.exists():
            dst_dir = result_dst / code
            dst_dir.mkdir(parents=True, exist_ok=True)
            shutil.copy2(chosen, dst_dir / chosen.name)
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
        f"echo Installing {APP_NAME} to %APP_DIR% ...\n"
        "if not exist \"%APP_DIR%\" mkdir \"%APP_DIR%\"\n"
        "robocopy \"%~dp0\" \"%APP_DIR%\" /E /XF install.bat >nul\n"
        "powershell -NoProfile -ExecutionPolicy Bypass -Command "
        "\"$desktop=[Environment]::GetFolderPath('Desktop'); "
        "$shortcut=(New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $desktop 'pathfinder_tools Lite.lnk')); "
        f"$shortcut.TargetPath=(Join-Path $env:LOCALAPPDATA '{APP_NAME}\\start.bat'); "
        f"$shortcut.WorkingDirectory=(Join-Path $env:LOCALAPPDATA '{APP_NAME}'); "
        "$shortcut.Save()\"\n"
        "echo Done. Starting pathfinder_tools Lite ...\n"
        "start \"\" \"%APP_DIR%\\start.bat\"\n",
        encoding="utf-8",
    )

    readme = target_dir / "README_中文.txt"
    readme.write_text(portable_readme_text(), encoding="utf-8")


def portable_readme_text() -> str:
    return (
        f"{APP_RELEASE_NAME} Lite 使用说明\n"
        "=========================\n\n"
        "这是 pathfinder_tools 的精简分发版，面向本地浏览和查询。它不包含数据提取脚本、CHM 原始文件、"
        "向量索引、BM25 索引、LLM 与 Embedding 相关依赖，因此体积比完整 RAG 版本更小。\n\n"
        "一、快速使用\n"
        "1. 解压整个压缩包，不要只单独拷贝 exe。\n"
        f"2. 双击 start.bat 或 {APP_NAME}.exe 直接运行。\n"
        "3. 程序会启动一个本地服务，并自动打开浏览器页面。\n"
        "4. 如果浏览器没有自动打开，请查看窗口中显示的地址，通常形如：\n"
        "   http://localhost:8000/web/\n\n"
        "二、安装到本机\n"
        "1. 双击 install.bat。\n"
        f"2. 程序会复制到：%LOCALAPPDATA%\\{APP_NAME}\n"
        "3. 安装脚本会在桌面创建“pathfinder_tools Lite”快捷方式。\n\n"
        "三、包含的功能\n"
        "- 法术检索：按名称、关键词、职业与环位查询。\n"
        "- 专长检索：按名称、关键词、类型、来源书筛选。\n"
        "- 职业资料：浏览职业、进阶职业、神话道途、变体和职业能力。\n"
        "- 奇物资料：浏览奇物条目、价格、部位、制造条件和详情。\n"
        "- 自动车卡：本地角色记录与资料选择辅助。\n"
        "- 人物卡状态记录器：维护战斗/冒险状态档案。\n\n"
        "四、不包含的功能\n"
        "- 不包含智能问答 RAG 生成能力。\n"
        "- 不包含数据抽取、清洗、回填脚本。\n"
        "- 不包含 Pathfinder v2.14 SC.chm / .chw 原始文件。\n"
        "- 不包含 Chroma 向量索引和 BM25 索引。\n"
        "- 不包含 OpenAI、Embedding、本地大模型等重依赖。\n\n"
        "五、目录说明\n"
        f"- {APP_NAME}.exe：主程序。\n"
        "- start.bat：从当前目录启动主程序。\n"
        "- install.bat：安装到用户目录并创建桌面快捷方式。\n"
        "- web/：前端页面文件。\n"
        "- result/：运行时查询使用的 JSON 数据。\n"
        "- data/：少量来源元数据。\n\n"
        "六、常见问题\n"
        f"1. 页面打不开：确认 {APP_NAME}.exe 仍在运行，并访问窗口中显示的 localhost 地址。\n"
        "2. 端口不是 8000：如果 8000 被占用，程序会自动选择其他可用端口，这是正常的。\n"
        "3. 查询没有结果：先确认当前页面的数据已加载完成，再尝试使用更短的关键词。\n"
        "4. 杀毒软件拦截：这是 PyInstaller 打包的本地服务程序，首次运行时可能需要手动允许。\n\n"
        "七、重新打包\n"
        "开发环境下可在项目根目录执行：\n"
        "python scripts\\package\\package_lite.py\n"
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


def clean_build_artifacts() -> None:
    if BUILD_WORK_DIR.exists():
        remove_tree(BUILD_WORK_DIR)
    remove_empty_build_root()

    if GENERATED_SPEC.exists():
        GENERATED_SPEC.unlink()


def main() -> None:
    clean_outputs()
    build_exe()
    build_portable_dir()
    zip_path = make_zip()
    clean_build_artifacts()

    print("\nPackage complete:")
    print(f"- Portable directory: {PORTABLE_DIR}")
    print(f"- Zip package:        {zip_path}")


if __name__ == "__main__":
    main()
