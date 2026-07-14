from __future__ import annotations

import html
import os
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    HRFlowable,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Preformatted,
    Spacer,
    Table,
    TableStyle,
)

from prd_common import COLORS, STATUS_TONES, Block, build_tree, load_document


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = Path(os.environ.get(
    "PRD_PDF_OUTPUT",
    ROOT / "output" / "pdf" / "零里说-无障碍在线导览-PRD.pdf",
))

PAGE_W, PAGE_H = A4
MARGIN_X = 17 * mm
MARGIN_TOP = 18 * mm
MARGIN_BOTTOM = 17 * mm
CONTENT_W = PAGE_W - 2 * MARGIN_X


def color(name: str):
    return colors.HexColor(COLORS[name])


PAPER = color("paper")
PAPER_DEEP = color("paper_deep")
INK = color("ink")
DEEP_GREEN = color("deep_green")
GREEN = color("green")
GREEN_DARK = color("green_dark")
MUTED = color("muted")
LINE = color("line")
SOFT_GREEN = color("soft_green")
FACILITY = color("facility")
FACILITY_SOFT = color("facility_soft")
INFO = color("info")
INFO_SOFT = color("info_soft")
WARNING = color("warning")
WARNING_SOFT = color("warning_soft")

STATUS_COLORS = {
    "已确认": (colors.HexColor("#276A42"), colors.HexColor("#E1F1E6")),
    "待确认": (colors.HexColor("#8A5A1F"), colors.HexColor("#FFF0D8")),
    "已具备": (colors.HexColor("#276A42"), colors.HexColor("#E1F1E6")),
    "仅作展示": (colors.HexColor("#76508F"), colors.HexColor("#F0E5F6")),
    "待技术落地": (colors.HexColor("#32657A"), colors.HexColor("#E2F0F4")),
    "待现场验证": (colors.HexColor("#9A4E2E"), colors.HexColor("#F8E7DF")),
    "P0": (colors.white, FACILITY),
    "P1": (DEEP_GREEN, SOFT_GREEN),
    "P2": (MUTED, PAPER_DEEP),
}


def register_fonts() -> None:
    candidates = [
        ("Deng", Path(r"C:\Windows\Fonts\Deng.ttf")),
        ("Deng-Bold", Path(r"C:\Windows\Fonts\Dengb.ttf")),
    ]
    for name, path in candidates:
        if not path.exists():
            raise FileNotFoundError(f"Required Chinese font not found: {path}")
        pdfmetrics.registerFont(TTFont(name, str(path)))


def inline_markup(value: str) -> str:
    escaped = html.escape(value.strip())
    escaped = re.sub(
        r"\[([^\]]+)\]\((https?://[^)]+)\)",
        lambda match: f'<a href="{match.group(2)}" color="{COLORS["green_dark"]}"><u>{match.group(1)}</u></a>',
        escaped,
    )
    escaped = re.sub(r"`([^`]+)`", rf'<font name="Deng-Bold" color="{COLORS["facility"]}">\1</font>', escaped)
    escaped = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", escaped)
    return escaped


def make_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "body": ParagraphStyle("BodyCN", parent=base["BodyText"], fontName="Deng", fontSize=9.2, leading=15.2, textColor=INK, spaceAfter=5.5, wordWrap="CJK"),
        "h2": ParagraphStyle("H2CN", parent=base["Heading2"], fontName="Deng-Bold", fontSize=18, leading=25, textColor=DEEP_GREEN, spaceAfter=0, wordWrap="CJK"),
        "h3": ParagraphStyle("H3CN", parent=base["Heading3"], fontName="Deng-Bold", fontSize=12.5, leading=18, textColor=DEEP_GREEN, spaceBefore=8, spaceAfter=6, keepWithNext=True, wordWrap="CJK"),
        "bullet": ParagraphStyle("BulletCN", parent=base["BodyText"], fontName="Deng", bulletFontName="Deng", bulletFontSize=9.1, fontSize=9.1, leading=14.6, leftIndent=13, firstLineIndent=-7, bulletIndent=4, textColor=INK, spaceAfter=3.5, wordWrap="CJK"),
        "table": ParagraphStyle("TableCN", parent=base["BodyText"], fontName="Deng", fontSize=7.1, leading=10.2, textColor=INK, wordWrap="CJK"),
        "table_small": ParagraphStyle("TableSmallCN", parent=base["BodyText"], fontName="Deng", fontSize=6.5, leading=9, textColor=INK, wordWrap="CJK"),
        "table_head": ParagraphStyle("TableHeadCN", parent=base["BodyText"], fontName="Deng-Bold", fontSize=7.2, leading=10.2, textColor=colors.white, wordWrap="CJK"),
        "card_title": ParagraphStyle("CardTitle", parent=base["BodyText"], fontName="Deng-Bold", fontSize=10.2, leading=14.5, textColor=DEEP_GREEN, spaceAfter=3, wordWrap="CJK"),
        "card_body": ParagraphStyle("CardBody", parent=base["BodyText"], fontName="Deng", fontSize=8.2, leading=12.2, textColor=INK, wordWrap="CJK"),
        "card_label": ParagraphStyle("CardLabel", parent=base["BodyText"], fontName="Deng-Bold", fontSize=6.7, leading=9, textColor=MUTED, wordWrap="CJK"),
        "callout_label": ParagraphStyle("CalloutLabel", parent=base["BodyText"], fontName="Deng-Bold", fontSize=9.3, leading=13, textColor=DEEP_GREEN, spaceAfter=2, wordWrap="CJK"),
        "callout": ParagraphStyle("CalloutCN", parent=base["BodyText"], fontName="Deng", fontSize=8.8, leading=14.2, textColor=DEEP_GREEN, wordWrap="CJK"),
        "code": ParagraphStyle("CodeCN", parent=base["Code"], fontName="Deng", fontSize=7.8, leading=11.5, leftIndent=8, rightIndent=8, borderPadding=8, backColor=colors.HexColor("#EAF1F1"), textColor=INK, wordWrap="CJK"),
        "cover_title": ParagraphStyle("CoverTitle", parent=base["Title"], fontName="Deng-Bold", fontSize=29, leading=38, textColor=DEEP_GREEN, spaceAfter=8, wordWrap="CJK"),
        "cover_sub": ParagraphStyle("CoverSub", parent=base["BodyText"], fontName="Deng", fontSize=13, leading=20, textColor=MUTED, spaceAfter=7, wordWrap="CJK"),
        "cover_meta": ParagraphStyle("CoverMeta", parent=base["BodyText"], fontName="Deng", fontSize=8.4, leading=13.5, textColor=INK, wordWrap="CJK"),
        "tree_root": ParagraphStyle("TreeRoot", parent=base["BodyText"], fontName="Deng-Bold", fontSize=9.3, leading=13, textColor=colors.white, wordWrap="CJK"),
        "tree_node": ParagraphStyle("TreeNode", parent=base["BodyText"], fontName="Deng", fontSize=8.2, leading=11.5, textColor=INK, wordWrap="CJK"),
        "flow_title": ParagraphStyle("FlowTitle", parent=base["BodyText"], fontName="Deng-Bold", fontSize=9.6, leading=13, textColor=DEEP_GREEN, wordWrap="CJK"),
        "flow_step": ParagraphStyle("FlowStep", parent=base["BodyText"], fontName="Deng", fontSize=8, leading=11.6, textColor=INK, wordWrap="CJK"),
    }


def callout_parts(value: str) -> tuple[str, str]:
    match = re.match(r"\[([^\]]+)\]\s*(.+)", value)
    return (match.group(1), match.group(2)) if match else ("说明", value)


def status_paragraph(value: str, style: ParagraphStyle) -> Paragraph:
    if value in STATUS_COLORS:
        foreground, _ = STATUS_COLORS[value]
        return Paragraph(f'<font name="Deng-Bold" color="{foreground.hexval()}">{html.escape(value)}</font>', style)
    return Paragraph(inline_markup(value), style)


def column_widths(header: list[str]) -> list[float]:
    width = len(header)
    if width == 2:
        return [CONTENT_W * 0.25, CONTENT_W * 0.75]
    if width == 3:
        return [CONTENT_W * 0.22, CONTENT_W * 0.28, CONTENT_W * 0.50]
    if width == 4:
        return [CONTENT_W * 0.17, CONTENT_W * 0.24, CONTENT_W * 0.38, CONTENT_W * 0.21]
    if width == 5:
        weights = [0.14, 0.20, 0.23, 0.21, 0.22]
        return [CONTENT_W * item for item in weights]
    return [CONTENT_W / width] * width


def standard_table(block: Block, styles: dict[str, ParagraphStyle]) -> Table:
    header = block.data["header"]
    rows = block.data["rows"]
    style = styles["table_small"] if len(header) >= 5 else styles["table"]
    data = [[Paragraph(inline_markup(cell), styles["table_head"]) for cell in header]]
    for row in rows:
        normalized = row + [""] * (len(header) - len(row))
        data.append([status_paragraph(cell, style) for cell in normalized[:len(header)]])
    table = Table(data, colWidths=column_widths(header), repeatRows=1, hAlign="LEFT", splitByRow=1)
    commands = [
        ("BACKGROUND", (0, 0), (-1, 0), DEEP_GREEN),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F4F7F4")]),
        ("GRID", (0, 0), (-1, -1), 0.35, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4.5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4.5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    for row_index, row in enumerate(rows, start=1):
        for col_index, cell in enumerate(row):
            if cell in STATUS_COLORS:
                _, background = STATUS_COLORS[cell]
                commands.append(("BACKGROUND", (col_index, row_index), (col_index, row_index), background))
    table.setStyle(TableStyle(commands))
    return table


def labeled_card(title: str, fields: list[tuple[str, str]], styles: dict[str, ParagraphStyle], accent=GREEN) -> Table:
    title_row = [Paragraph(inline_markup(title), styles["card_title"])]
    body = []
    for label, value in fields:
        body.append([
            Paragraph(inline_markup(label), styles["card_label"]),
            status_paragraph(value, styles["card_body"]),
        ])
    inner = Table(body, colWidths=[27 * mm, CONTENT_W - 35 * mm], hAlign="LEFT")
    inner.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    outer = Table([[title_row[0]], [inner]], colWidths=[CONTENT_W - 8 * mm], hAlign="LEFT")
    outer.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F4F7F4")),
        ("BOX", (0, 0), (-1, -1), 0.55, LINE),
        ("LINEBEFORE", (0, 0), (0, -1), 3, accent),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return outer


def card_table(block: Block, styles: dict[str, ParagraphStyle], accent=GREEN) -> list[Flowable]:
    header = block.data["header"]
    result: list[Flowable] = []
    for row in block.data["rows"]:
        cells = dict(zip(header, row))
        title_key = header[0]
        title = cells.get(title_key, "")
        fields = [(key, cells.get(key, "")) for key in header[1:]]
        result.append(KeepTogether([labeled_card(title, fields, styles, accent), Spacer(1, 5)]))
    return result


def requirements_cards(block: Block, styles: dict[str, ParagraphStyle]) -> list[Flowable]:
    header = block.data["header"]
    result: list[Flowable] = []
    for row in block.data["rows"]:
        cells = dict(zip(header, row))
        title = f'{cells.get("需求编号", "")}  {cells.get("用户需求", "")}'
        fields = [
            ("产品行为", cells.get("产品行为", "")),
            ("优先级 / 决策", f'{cells.get("优先级", "")} / {cells.get("决策状态", "")}'),
            ("落地状态", cells.get("落地状态", "")),
            ("Owner", cells.get("Owner", "")),
            ("依赖", cells.get("依赖", "")),
            ("验收", cells.get("验收方式", "")),
        ]
        result.append(KeepTogether([labeled_card(title, fields, styles, FACILITY if cells.get("优先级") == "P0" else GREEN), Spacer(1, 5)]))
    return result


def render_table(block: Block, styles: dict[str, ParagraphStyle]) -> list[Flowable]:
    role = block.data["role"]
    if role == "requirements":
        return requirements_cards(block, styles)
    if role in {"roadmap", "decisions"}:
        return card_table(block, styles, INFO if role == "decisions" else GREEN)
    if len(block.data["header"]) > 5:
        return card_table(block, styles)
    return [standard_table(block, styles), Spacer(1, 6)]


def tree_flowables(block: Block, styles: dict[str, ParagraphStyle]) -> list[Flowable]:
    result: list[Flowable] = []

    def visit(nodes: list[dict], level: int = 0) -> None:
        for node in nodes:
            is_root = level == 0
            table = Table(
                [[Paragraph(inline_markup(node["label"]), styles["tree_root"] if is_root else styles["tree_node"])]],
                colWidths=[CONTENT_W - 8 * mm - level * 8 * mm],
                hAlign="LEFT",
            )
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), DEEP_GREEN if is_root else colors.white),
                ("BOX", (0, 0), (-1, -1), 0.45, DEEP_GREEN if is_root else LINE),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]))
            result.append(Table([["", table]], colWidths=[level * 8 * mm, CONTENT_W - level * 8 * mm], hAlign="LEFT", style=[("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 1.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5)]))
            visit(node["children"], level + 1)

    result.append(Paragraph(f'{inline_markup(block.title)}结构图', styles["card_title"]))
    visit(build_tree(block.data))
    result.append(Spacer(1, 7))
    return result


def flow_flowables(block: Block, styles: dict[str, ParagraphStyle]) -> list[Flowable]:
    result: list[Flowable] = [Paragraph(f'{inline_markup(block.title)}流程图', styles["card_title"])]
    for raw in block.data:
        cells = [cell.strip() for cell in raw.split("|") if cell.strip()]
        if len(cells) < 2:
            continue
        result.append(Paragraph(inline_markup(cells[0]), styles["flow_title"]))
        rows = []
        for index, step in enumerate(cells[1:], start=1):
            rows.append([
                Paragraph(f'<b>{index:02d}</b>', styles["flow_step"]),
                Paragraph(inline_markup(step), styles["flow_step"]),
            ])
        table = Table(rows, colWidths=[14 * mm, CONTENT_W - 14 * mm], hAlign="LEFT")
        table.setStyle(TableStyle([
            ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#F4F7F4")]),
            ("BOX", (0, 0), (-1, -1), 0.45, LINE),
            ("INNERGRID", (0, 0), (-1, -1), 0.3, LINE),
            ("TEXTCOLOR", (0, 0), (0, -1), GREEN_DARK),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        result.extend([table, Spacer(1, 7)])
    return result


def chapter_heading(block: Block, styles: dict[str, ParagraphStyle]) -> Table:
    number = Paragraph(f'<font color="{COLORS["green"]}"><b>{html.escape(block.number)}</b></font>', styles["h3"])
    title = Paragraph(inline_markup(block.title), styles["h2"])
    table = Table([[number, title]], colWidths=[16 * mm, CONTENT_W - 16 * mm], hAlign="LEFT")
    table.setStyle(TableStyle([
        ("LINEABOVE", (0, 0), (-1, 0), 1.2, DEEP_GREEN),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return table


def body_story(styles: dict[str, ParagraphStyle]) -> list[Flowable]:
    document = load_document()
    story: list[Flowable] = []
    h2_seen = 0
    for block in document.blocks:
        if block.kind == "heading" and block.level == 2:
            if h2_seen:
                story.append(PageBreak())
            story.append(chapter_heading(block, styles))
            h2_seen += 1
        elif block.kind == "heading":
            story.append(Paragraph(f'<font color="{COLORS["green"]}" size="7">{html.escape(block.number)}</font>  {inline_markup(block.title)}', styles["h3"]))
        elif block.kind == "paragraph":
            story.append(Paragraph(inline_markup(block.data), styles["body"]))
        elif block.kind == "list":
            for index, item in enumerate(block.data, start=1):
                bullet = "-" if block.title == "unordered" else f"{index}."
                story.append(Paragraph(inline_markup(item), styles["bullet"], bulletText=bullet))
            story.append(Spacer(1, 3))
        elif block.kind == "quote":
            label, content = callout_parts(block.data)
            inner = [[Paragraph(inline_markup(label), styles["callout_label"])], [Paragraph(inline_markup(content), styles["callout"])]]
            table = Table(inner, colWidths=[CONTENT_W - 8 * mm], hAlign="LEFT")
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), SOFT_GREEN),
                ("LINEBEFORE", (0, 0), (0, -1), 3, GREEN),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]))
            story.extend([table, Spacer(1, 7)])
        elif block.kind == "table":
            story.extend(render_table(block, styles))
        elif block.kind == "diagram-tree":
            story.extend(tree_flowables(block, styles))
        elif block.kind == "diagram-flow":
            story.extend(flow_flowables(block, styles))
        elif block.kind == "code":
            story.append(Preformatted("\n".join(block.data), styles["code"], maxLineLength=95))
    return story


CURRENT_STAGE = "项目背景、需求与信息架构确认"


def page_decor(canvas, doc) -> None:
    canvas.saveState()
    page = canvas.getPageNumber()
    canvas.setFillColor(DEEP_GREEN)
    canvas.rect(0, PAGE_H - 9 * mm, PAGE_W, 9 * mm, fill=1, stroke=0)
    canvas.setFont("Deng-Bold", 8)
    canvas.setFillColor(colors.white)
    canvas.drawString(MARGIN_X, PAGE_H - 6 * mm, "零里说 · 无障碍在线导览")
    canvas.setFont("Deng", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(MARGIN_X, 8 * mm, f"项目级产品需求文档 · {CURRENT_STAGE}")
    canvas.drawRightString(PAGE_W - MARGIN_X, 8 * mm, str(page))
    canvas.setStrokeColor(LINE)
    canvas.line(MARGIN_X, 12 * mm, PAGE_W - MARGIN_X, 12 * mm)
    canvas.restoreState()


def cover_decor(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFillColor(PAPER)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    canvas.setFillColor(DEEP_GREEN)
    canvas.rect(0, PAGE_H - 35 * mm, PAGE_W, 35 * mm, fill=1, stroke=0)
    canvas.setFillColor(GREEN)
    canvas.circle(PAGE_W - 30 * mm, PAGE_H - 22 * mm, 7 * mm, fill=1, stroke=0)
    canvas.setStrokeColor(colors.white)
    canvas.setLineWidth(1.5)
    canvas.line(MARGIN_X, PAGE_H - 22 * mm, PAGE_W - 44 * mm, PAGE_H - 22 * mm)
    canvas.restoreState()


def build() -> Path:
    register_fonts()
    styles = make_styles()
    document = load_document()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    doc = BaseDocTemplate(
        str(OUTPUT), pagesize=A4,
        leftMargin=MARGIN_X, rightMargin=MARGIN_X,
        topMargin=MARGIN_TOP, bottomMargin=MARGIN_BOTTOM,
        title=document.title,
        author="零里说项目组",
        subject="项目级产品需求文档",
    )
    cover_frame = Frame(MARGIN_X, MARGIN_BOTTOM, CONTENT_W, PAGE_H - MARGIN_BOTTOM - 42 * mm, id="cover")
    body_frame = Frame(MARGIN_X, MARGIN_BOTTOM, CONTENT_W, PAGE_H - MARGIN_TOP - MARGIN_BOTTOM, id="body")
    doc.addPageTemplates([
        PageTemplate(id="Cover", frames=[cover_frame], onPage=cover_decor, autoNextPageTemplate="Body"),
        PageTemplate(id="Body", frames=[body_frame], onPage=page_decor),
    ])

    meta_rows = [[Paragraph(inline_markup(label), styles["card_label"]), Paragraph(inline_markup(value), styles["cover_meta"])] for label, value in document.metadata]
    meta_table = Table(meta_rows, colWidths=[28 * mm, CONTENT_W - 40 * mm], hAlign="LEFT")
    meta_table.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, -1), 0.35, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    label, note = callout_parts(document.note)
    cover_note = Table([[Paragraph(inline_markup(label), styles["callout_label"])], [Paragraph(inline_markup(note), styles["callout"])]], colWidths=[CONTENT_W - 14 * mm], hAlign="LEFT")
    cover_note.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SOFT_GREEN),
        ("LINEBEFORE", (0, 0), (0, -1), 4, GREEN),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    cover = [
        Spacer(1, 43 * mm),
        Paragraph("零里说", styles["cover_title"]),
        Paragraph("无障碍在线导览 PRD", styles["cover_title"]),
        Paragraph("全民友好的居民文化导览", styles["cover_sub"]),
        Spacer(1, 7 * mm),
        HRFlowable(width="30%", thickness=3, color=GREEN, hAlign="LEFT"),
        Spacer(1, 7 * mm),
        meta_table,
        Spacer(1, 10 * mm),
        cover_note,
        PageBreak(),
    ]
    doc.build(cover + body_story(styles))
    return OUTPUT


if __name__ == "__main__":
    print(build())
