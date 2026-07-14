from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

from pypdf import PdfReader

from prd_common import STATUS_TONES, load_document, status_counts


ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "output" / "html" / "零里说-无障碍在线导览-PRD.html"
PDF = ROOT / "output" / "pdf" / "零里说-无障碍在线导览-PRD.pdf"
PROTOTYPE = ROOT / "demo" / "原型说明.md"
RENDER_DIR = ROOT / "tmp" / "pdfs"


def fail(message: str) -> None:
    raise AssertionError(message)


def find_pdftoppm() -> Path:
    candidate = Path.home() / ".cache" / "codex-runtimes" / "codex-primary-runtime" / "dependencies" / "native" / "poppler" / "Library" / "bin" / "pdftoppm.exe"
    if candidate.exists():
        return candidate
    direct = shutil.which("pdftoppm")
    if direct:
        return Path(direct)
    fail("pdftoppm is required to render and visually verify the PDF")


def build_outputs() -> None:
    subprocess.run([sys.executable, str(ROOT / "scripts" / "build_prd_html.py")], cwd=ROOT, check=True)
    subprocess.run([sys.executable, str(ROOT / "scripts" / "build_prd_pdf.py")], cwd=ROOT, check=True)


def verify_source() -> None:
    document = load_document()
    source = (ROOT / "PRD.md").read_text(encoding="utf-8")
    prototype = PROTOTYPE.read_text(encoding="utf-8")
    required = [
        "产品概览", "用户任务与内容结构", "信息架构与入口路径",
        "核心需求与验收", "当前状态与协作分工", "验收与配套文档",
    ]
    missing = [name for name in required if not any(chapter.title == name for chapter in document.chapters)]
    if missing:
        fail(f"missing chapters: {', '.join(missing)}")
    if len(document.chapters) != 6:
        fail(f"expected 6 concise chapters, found {len(document.chapters)}")
    for path_text in [
        "地图首页 → 底部操作区 → 当前位置",
        "地图首页 → 居民讲解 → 听讲解",
        "地图首页 → 底部操作区 → 附近设施",
    ]:
        if path_text not in source:
            fail(f"missing location entry path: {path_text}")
    for state_text in ["首次或尚未授权", "已授权且位置有效", "权限被拒绝", "定位失败", "精度不足"]:
        if state_text not in source:
            fail(f"missing location state: {state_text}")
    if "打开产品、切换内容域、浏览点位或查看详情均不主动申请定位" not in source:
        fail("on-demand location rule is missing")
    if "不得使用“最近”" not in source:
        fail("low-accuracy wording boundary is missing")
    if "讲解完成后选择下一讲解点会先返回地图并打开候选弹层" not in source:
        fail("next-guide map transition rule is missing")
    if "不固化具体点位" not in source:
        fail("project PRD must keep Demo guide IDs out of the formal flow")
    if "V0.9" in source:
        fail("main PRD contains obsolete version-specific framing")
    if "s3 -> s1 -> r5" in source:
        fail("fixed Demo sequence leaked into the project PRD")
    if "s3 -> s1 -> r5 -> s3" not in prototype:
        fail("prototype details were not preserved")
    counts = status_counts(document)
    for status in STATUS_TONES:
        if counts[status] == 0:
            fail(f"status is defined but unused in structured tables: {status}")


def verify_html() -> None:
    if not HTML.exists() or HTML.stat().st_size < 30_000:
        fail("HTML output is missing or unexpectedly small")
    generated = HTML.read_text(encoding="utf-8")
    for marker in ["summary-card", "domain-card", "architecture-viz", "flow-lane", "status-pill"]:
        if marker not in generated:
            fail(f"HTML visual component missing: {marker}")
    if "讲解完成后选择下一讲解点会先返回地图并打开候选弹层" not in generated:
        fail("HTML is missing the next-guide map transition")
    if "V0.9" in generated:
        fail("HTML contains obsolete version text")


def verify_pdf() -> int:
    if not PDF.exists() or PDF.stat().st_size < 50_000:
        fail("PDF output is missing or unexpectedly small")
    reader = PdfReader(str(PDF))
    if not 8 <= len(reader.pages) <= 10:
        fail(f"PDF page count must be 8-10 pages, found {len(reader.pages)}")
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    for phrase in [
        "产品概览", "用户任务与内容结构", "信息架构与入口路径",
        "定位触发入口与功能路径", "基础运营后台与前台映射",
        "讲解完成后选择下一讲解点会先返回地图并打开候选弹层",
        "核心需求与验收", "当前状态与协作分工", "验收与配套文档",
    ]:
        if phrase not in text:
            fail(f"PDF text is missing: {phrase}")
    if "V0.9" in text:
        fail("PDF contains obsolete version text")
    return len(reader.pages)


def render_pdf(page_count: int) -> int:
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    for old in RENDER_DIR.glob("prd-page-*.png"):
        old.unlink()
    output_prefix = RENDER_DIR / "prd-page"
    subprocess.run([
        str(find_pdftoppm()), "-png", "-r", "120", str(PDF), str(output_prefix)
    ], check=True)
    rendered = sorted(RENDER_DIR.glob("prd-page-*.png"))
    if len(rendered) != page_count:
        fail(f"rendered {len(rendered)} pages, expected {page_count}")
    if any(path.stat().st_size < 15_000 for path in rendered):
        fail("one or more rendered PDF pages are unexpectedly small")
    return len(rendered)


def main() -> None:
    build_outputs()
    verify_source()
    verify_html()
    page_count = verify_pdf()
    rendered_count = render_pdf(page_count)
    print(f"PRD output verification passed: {len(load_document().chapters)} chapters, {page_count} PDF pages, {rendered_count} rendered PNGs")
    print(f"HTML: {HTML}")
    print(f"PDF: {PDF}")
    print(f"Rendered pages: {RENDER_DIR}")


if __name__ == "__main__":
    main()
