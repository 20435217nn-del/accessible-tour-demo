from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "PRD.md"

COLORS = {
    "paper": "#FBF7EE",
    "paper_deep": "#F2ECDF",
    "ink": "#163321",
    "deep_green": "#214D34",
    "green": "#428C5C",
    "green_dark": "#32734A",
    "muted": "#627A68",
    "line": "#D4DFD7",
    "soft_green": "#E2EBE5",
    "facility": "#B06540",
    "facility_soft": "#F5EBE6",
    "white": "#FFFFFF",
    "warning": "#9A5A24",
    "warning_soft": "#FFF0DD",
    "info": "#356B7D",
    "info_soft": "#E7F1F3",
}

STATUS_TONES = {
    "已确认": "confirmed",
    "待确认": "pending",
    "已具备": "ready",
    "仅作展示": "demo",
    "待技术落地": "technical",
    "待现场验证": "field",
}


@dataclass
class Block:
    kind: str
    data: Any
    level: int = 0
    title: str = ""
    number: str = ""
    block_id: str = ""


@dataclass
class Chapter:
    number: str
    title: str
    chapter_id: str


@dataclass
class Document:
    title: str
    metadata: list[tuple[str, str]]
    note: str
    blocks: list[Block] = field(default_factory=list)
    chapters: list[Chapter] = field(default_factory=list)

    def meta(self, label: str, default: str = "") -> str:
        return next((value for key, value in self.metadata if key == label), default)


def split_table_row(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def is_table_divider(line: str) -> bool:
    cells = split_table_row(line)
    return bool(cells) and all(re.fullmatch(r":?-{3,}:?", cell.replace(" ", "")) for cell in cells)


def heading_parts(text: str, fallback: int) -> tuple[str, str, str]:
    match = re.match(r"(\d+(?:\.\d+)*)(?:\.)?\s+(.+)", text.strip())
    if match:
        number, title = match.groups()
        return number, title, "section-" + number.replace(".", "-")
    return str(fallback), text.strip(), f"section-{fallback}"


def table_role(header: list[str], context_title: str = "") -> str:
    joined = "|".join(header)
    if header[:2] == ["维度", "项目定义"]:
        return "summary"
    if header and header[0] == "状态轴":
        return "status-legend"
    if header and header[0] == "内容域":
        return "domains"
    if header and header[0] == "阶段":
        return "roadmap"
    if header and header[0] == "需求编号":
        return "requirements"
    if header and header[0] == "能力/资产":
        return "delivery-status"
    if "待确认事项" in joined:
        return "decisions"
    if "风险" in header and "控制措施" in header:
        return "risks"
    if context_title == "职能责任":
        return "ownership"
    return "standard"


def parse_document(text: str) -> Document:
    lines = text.splitlines()
    if not lines or not lines[0].startswith("# "):
        raise ValueError("PRD.md must begin with one H1 title")

    title = lines[0][2:].strip()
    metadata: list[tuple[str, str]] = []
    note = ""
    index = 1

    while index < len(lines):
        line = lines[index].strip()
        if not line:
            index += 1
            continue
        if line.startswith("|") and index + 1 < len(lines) and is_table_divider(lines[index + 1]):
            rows = []
            index += 2
            while index < len(lines) and lines[index].strip().startswith("|"):
                rows.append(split_table_row(lines[index]))
                index += 1
            metadata.extend((row[0], row[1]) for row in rows if len(row) >= 2)
            continue
        if line.startswith(">"):
            quote_lines = []
            while index < len(lines) and lines[index].strip().startswith(">"):
                quote_lines.append(lines[index].strip().lstrip("> "))
                index += 1
            note = " ".join(quote_lines)
            continue
        if line.startswith("## "):
            break
        index += 1

    blocks: list[Block] = []
    chapters: list[Chapter] = []
    current_heading = "内容"
    paragraph: list[str] = []

    def flush_paragraph() -> None:
        nonlocal paragraph
        if paragraph:
            blocks.append(Block("paragraph", " ".join(item.strip() for item in paragraph)))
            paragraph = []

    while index < len(lines):
        raw = lines[index]
        line = raw.strip()

        if not line:
            flush_paragraph()
            index += 1
            continue

        heading = re.match(r"^(#{2,3})\s+(.+)$", line)
        if heading:
            flush_paragraph()
            level = len(heading.group(1))
            number, title_text, block_id = heading_parts(heading.group(2), len(chapters) + 1)
            block = Block("heading", title_text, level=level, title=title_text, number=number, block_id=block_id)
            blocks.append(block)
            current_heading = title_text
            if level == 2:
                chapters.append(Chapter(number, title_text, block_id))
            index += 1
            continue

        if line.startswith("```"):
            flush_paragraph()
            language = line[3:].strip()
            index += 1
            content: list[str] = []
            while index < len(lines) and not lines[index].strip().startswith("```"):
                content.append(lines[index].rstrip())
                index += 1
            if index < len(lines):
                index += 1
            kind = "diagram-tree" if language == "prd-tree" else "diagram-flow" if language == "prd-flow" else "code"
            blocks.append(Block(kind, content, title=current_heading))
            continue

        if line.startswith("|") and index + 1 < len(lines) and is_table_divider(lines[index + 1]):
            flush_paragraph()
            header = split_table_row(raw)
            index += 2
            rows: list[list[str]] = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                rows.append(split_table_row(lines[index]))
                index += 1
            blocks.append(Block("table", {"header": header, "rows": rows, "role": table_role(header, current_heading)}, title=current_heading))
            continue

        if line.startswith(">"):
            flush_paragraph()
            quote_lines = []
            while index < len(lines) and lines[index].strip().startswith(">"):
                quote_lines.append(lines[index].strip().lstrip("> "))
                index += 1
            blocks.append(Block("quote", " ".join(quote_lines), title=current_heading))
            continue

        unordered = re.match(r"^[-*]\s+(.+)$", line)
        ordered = re.match(r"^\d+\.\s+(.+)$", line)
        if unordered or ordered:
            flush_paragraph()
            list_kind = "unordered" if unordered else "ordered"
            items: list[str] = []
            while index < len(lines):
                candidate = lines[index].strip()
                match = re.match(r"^[-*]\s+(.+)$", candidate) if list_kind == "unordered" else re.match(r"^\d+\.\s+(.+)$", candidate)
                if not match:
                    break
                items.append(match.group(1))
                index += 1
            blocks.append(Block("list", items, title=list_kind))
            continue

        paragraph.append(raw)
        index += 1

    flush_paragraph()
    return Document(title=title, metadata=metadata, note=note, blocks=blocks, chapters=chapters)


def load_document(path: Path = SOURCE) -> Document:
    return parse_document(path.read_text(encoding="utf-8"))


def build_tree(lines: list[str]) -> list[dict[str, Any]]:
    forest: list[dict[str, Any]] = []
    stack: list[dict[str, Any]] = []
    for raw in lines:
        if not raw.strip():
            continue
        spaces = len(raw) - len(raw.lstrip(" "))
        level = spaces // 2
        node: dict[str, Any] = {"label": raw.strip(), "children": [], "level": level}
        while len(stack) > level:
            stack.pop()
        if stack:
            stack[-1]["children"].append(node)
        else:
            forest.append(node)
        stack.append(node)
    return forest


def status_counts(document: Document) -> dict[str, int]:
    counts = {status: 0 for status in STATUS_TONES}
    for block in document.blocks:
        if block.kind != "table":
            continue
        for row in block.data["rows"]:
            for cell in row:
                if cell in counts:
                    counts[cell] += 1
    return counts
