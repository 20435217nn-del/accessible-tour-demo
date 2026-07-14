from __future__ import annotations

import html
import os
import re
from pathlib import Path

from prd_common import COLORS, STATUS_TONES, Block, build_tree, load_document


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = Path(os.environ.get(
    "PRD_HTML_OUTPUT",
    ROOT / "output" / "html" / "零里说-无障碍在线导览-PRD.html",
))


def inline_markup(value: str) -> str:
    escaped = html.escape(value.strip())
    escaped = re.sub(
        r"\[([^\]]+)\]\((https?://[^)]+|#[^)]+)\)",
        lambda match: f'<a href="{match.group(2)}">{match.group(1)}</a>',
        escaped,
    )
    escaped = re.sub(r"`([^`]+)`", r"<code>\1</code>", escaped)
    escaped = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", escaped)
    return escaped


def status_markup(value: str) -> str:
    if value in STATUS_TONES:
        return f'<span class="status-pill status-{STATUS_TONES[value]}"><span aria-hidden="true"></span>{html.escape(value)}</span>'
    if re.fullmatch(r"P[0-2]", value):
        return f'<span class="priority-pill priority-{value.lower()}">{html.escape(value)}</span>'
    return inline_markup(value)


def icon_svg(kind: str = "info") -> str:
    paths = {
        "info": '<circle cx="12" cy="12" r="9"></circle><path d="M12 10v6M12 7h.01"></path>',
        "map": '<path d="m3 6 5-2 8 3 5-2v13l-5 2-8-3-5 2V6Z"></path><path d="M8 4v13M16 7v13"></path>',
        "flow": '<circle cx="5" cy="12" r="2"></circle><circle cx="19" cy="5" r="2"></circle><circle cx="19" cy="19" r="2"></circle><path d="M7 12h5a7 7 0 0 0 7-7M12 12a7 7 0 0 1 7 7"></path>',
        "people": '<circle cx="9" cy="8" r="3"></circle><path d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6"></path><circle cx="17" cy="9" r="2"></circle><path d="M16 14c2.8 0 5 2.2 5 5"></path>',
    }
    return f'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{paths.get(kind, paths["info"])}</svg>'


def render_standard_table(block: Block) -> str:
    header = block.data["header"]
    rows = block.data["rows"]
    role = block.data["role"]
    head_html = "".join(f'<th scope="col">{inline_markup(cell)}</th>' for cell in header)
    body_html = "".join(
        "<tr>" + "".join(f"<td>{status_markup(cell)}</td>" for cell in row) + "</tr>"
        for row in rows
    )
    return (
        f'<div class="table-wrap table-{role}" role="region" aria-label="{html.escape(block.title)}表格" tabindex="0">'
        f'<table><thead><tr>{head_html}</tr></thead><tbody>{body_html}</tbody></table></div>'
    )


def render_summary(block: Block) -> str:
    cards = []
    for index, row in enumerate(block.data["rows"]):
        if len(row) < 2:
            continue
        cards.append(
            f'<article class="summary-card" role="listitem"><span class="card-index">{index + 1:02d}</span>'
            f'<h4>{inline_markup(row[0])}</h4><p>{inline_markup(row[1])}</p></article>'
        )
    return '<div class="summary-grid" role="list" aria-label="项目一页看板">' + "".join(cards) + "</div>"


def render_domains(block: Block) -> str:
    header = block.data["header"]
    cards = []
    for index, row in enumerate(block.data["rows"]):
        cells = dict(zip(header, row))
        cards.append(
            f'<article class="domain-card" role="listitem"><div class="domain-top"><span class="domain-index">0{index + 1}</span>'
            f'<h4>{inline_markup(cells.get("内容域", ""))}</h4></div>'
            f'<p class="domain-question">{inline_markup(cells.get("用户问题", ""))}</p>'
            f'<dl><div><dt>核心对象</dt><dd>{inline_markup(cells.get("核心对象", ""))}</dd></div>'
            f'<div><dt>主要入口</dt><dd>{inline_markup(cells.get("主要入口", ""))}</dd></div>'
            f'<div><dt>主要去向</dt><dd>{inline_markup(cells.get("主要去向", ""))}</dd></div></dl></article>'
        )
    return '<div class="domain-grid" role="list" aria-label="三个内容域">' + "".join(cards) + "</div>"


def render_roadmap(block: Block) -> str:
    header = block.data["header"]
    items = []
    for index, row in enumerate(block.data["rows"]):
        cells = dict(zip(header, row))
        items.append(
            f'<article class="roadmap-item" role="listitem"><div class="roadmap-marker"><span>{index + 1}</span></div>'
            f'<div class="roadmap-card"><div class="roadmap-heading"><h4>{inline_markup(cells.get("阶段", ""))}</h4>'
            f'<span>{inline_markup(cells.get("Owner", ""))}</span></div>'
            f'<p>{inline_markup(cells.get("核心任务", ""))}</p>'
            f'<dl><div><dt>交付物</dt><dd>{inline_markup(cells.get("主要交付物", ""))}</dd></div>'
            f'<div><dt>前置依赖</dt><dd>{inline_markup(cells.get("前置依赖", ""))}</dd></div>'
            f'<div><dt>完成标准</dt><dd>{inline_markup(cells.get("完成标准", ""))}</dd></div></dl></div></article>'
        )
    return '<div class="roadmap" role="list" aria-label="项目阶段里程碑">' + "".join(items) + "</div>"


def render_table(block: Block) -> str:
    role = block.data["role"]
    if role == "summary":
        return render_summary(block)
    if role == "domains":
        return render_domains(block)
    if role == "roadmap":
        return render_roadmap(block)
    return render_standard_table(block)


def render_tree_nodes(nodes: list[dict]) -> str:
    parts = ["<ul>"]
    for node in nodes:
        parts.append(f'<li><span class="tree-node">{inline_markup(node["label"])}</span>')
        if node["children"]:
            parts.append(render_tree_nodes(node["children"]))
        parts.append("</li>")
    parts.append("</ul>")
    return "".join(parts)


def render_tree(block: Block) -> str:
    nodes = build_tree(block.data)
    return (
        f'<figure class="architecture-viz"><figcaption>{icon_svg("map")}<span>{html.escape(block.title)}结构图</span></figcaption>'
        f'<div class="tree" role="group" aria-label="{html.escape(block.title)}">{render_tree_nodes(nodes)}</div></figure>'
    )


def render_flow(block: Block) -> str:
    lanes = []
    for raw in block.data:
        cells = [cell.strip() for cell in raw.split("|") if cell.strip()]
        if len(cells) < 2:
            continue
        title, steps = cells[0], cells[1:]
        step_html = "".join(
            f'<li><span class="step-index">{index + 1}</span><span>{inline_markup(step)}</span></li>'
            for index, step in enumerate(steps)
        )
        lanes.append(f'<article class="flow-lane"><h4>{inline_markup(title)}</h4><ol>{step_html}</ol></article>')
    return (
        f'<figure class="flow-viz"><figcaption>{icon_svg("flow")}<span>{html.escape(block.title)}流程图</span></figcaption>'
        + "".join(lanes) + "</figure>"
    )


def callout_parts(value: str) -> tuple[str, str]:
    match = re.match(r"\[([^\]]+)\]\s*(.+)", value)
    return (match.group(1), match.group(2)) if match else ("说明", value)


def render_body(blocks: list[Block]) -> str:
    output: list[str] = []
    section_open = False
    for block in blocks:
        if block.kind == "heading" and block.level == 2:
            if section_open:
                output.append('<a class="back-to-directory" href="#directory">返回目录</a></section>')
            output.append(
                f'<section class="chapter" id="{block.block_id}" tabindex="-1">'
                f'<div class="chapter-heading"><span class="chapter-number">{html.escape(block.number)}</span>'
                f'<h2>{inline_markup(block.title)}</h2></div>'
            )
            section_open = True
        elif block.kind == "heading":
            output.append(
                f'<h3 id="{block.block_id}" tabindex="-1"><span>{html.escape(block.number)}</span>{inline_markup(block.title)}</h3>'
            )
        elif block.kind == "paragraph":
            output.append(f'<p>{inline_markup(block.data)}</p>')
        elif block.kind == "list":
            tag = "ul" if block.title == "unordered" else "ol"
            output.append(f'<{tag}>' + "".join(f'<li>{inline_markup(item)}</li>' for item in block.data) + f'</{tag}>')
        elif block.kind == "quote":
            label, content = callout_parts(block.data)
            output.append(
                f'<aside class="callout" role="note"><div class="callout-icon">{icon_svg("info")}</div>'
                f'<div><strong>{inline_markup(label)}</strong><p>{inline_markup(content)}</p></div></aside>'
            )
        elif block.kind == "table":
            output.append(render_table(block))
        elif block.kind == "diagram-tree":
            output.append(render_tree(block))
        elif block.kind == "diagram-flow":
            output.append(render_flow(block))
        elif block.kind == "code":
            output.append(f'<pre><code>{html.escape(chr(10).join(block.data))}</code></pre>')
    if section_open:
        output.append('<a class="back-to-directory" href="#directory">返回目录</a></section>')
    return "\n".join(output)


def build_html() -> str:
    document = load_document()
    metadata = "".join(
        f'<div class="meta-row"><dt>{inline_markup(label)}</dt><dd>{inline_markup(value)}</dd></div>'
        for label, value in document.metadata
    )
    toc = "".join(
        f'<li><a class="toc-link" href="#{chapter.chapter_id}"><span>{html.escape(chapter.number)}</span>'
        f'<strong>{inline_markup(chapter.title)}</strong></a></li>'
        for chapter in document.chapters
    )
    side = "".join(
        f'<a class="side-link" href="#{chapter.chapter_id}"><span>{html.escape(chapter.number)}</span>{inline_markup(chapter.title)}</a>'
        for chapter in document.chapters
    )
    note_label, note_content = callout_parts(document.note)
    c = COLORS
    return f'''<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="description" content="零里说无障碍在线导览项目级产品需求文档">
  <title>{html.escape(document.title)}</title>
  <style>
    :root {{
      --paper:{c['paper']};--paper-deep:{c['paper_deep']};--ink:{c['ink']};--deep-green:{c['deep_green']};
      --green:{c['green']};--green-dark:{c['green_dark']};--muted:{c['muted']};--line:{c['line']};
      --soft-green:{c['soft_green']};--facility:{c['facility']};--facility-soft:{c['facility_soft']};
      --warning:{c['warning']};--warning-soft:{c['warning_soft']};--info:{c['info']};--info-soft:{c['info_soft']};
      --white:{c['white']};--font-body:"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif;
      --font-display:"Songti SC","STSong","SimSun",serif;
    }}
    *,*::before,*::after{{box-sizing:border-box}} html{{scroll-behavior:auto;background:var(--paper)}}
    body{{margin:0;color:var(--ink);background:var(--paper);font-family:var(--font-body);font-size:17px;line-height:1.78;-webkit-font-smoothing:antialiased}}
    a{{color:var(--green-dark);text-underline-offset:3px}} a:focus-visible,[tabindex]:focus-visible{{outline:3px solid rgba(66,140,92,.6);outline-offset:4px}}
    h1,h2,h3,h4,p{{margin-top:0}} p{{margin-bottom:1.05em;max-width:42em}} code{{padding:.12em .38em;border-radius:5px;background:#efe6d7;color:#7d442d;font: .88em Consolas,monospace}}
    .icon{{width:22px;height:22px;flex:none}} .skip-link{{position:fixed;z-index:200;top:8px;left:8px;min-height:44px;padding:10px 16px;transform:translateY(-160%);background:var(--ink);color:white;font-weight:700}} .skip-link:focus{{transform:none}}
    .project-home-link{{position:fixed;z-index:190;top:18px;left:18px;display:inline-flex;min-width:118px;min-height:44px;align-items:center;justify-content:center;gap:9px;padding:9px 14px;border:1px solid rgba(22,51,33,.16);border-radius:999px;background:rgba(251,247,238,.92);box-shadow:0 8px 24px rgba(22,51,33,.12);color:var(--deep-green);font-size:13px;font-weight:750;line-height:1;text-decoration:none;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}} .project-home-link svg{{width:18px;height:18px;flex:none}} .project-home-link:hover{{background:var(--white)}}
    .cover{{min-height:100svh;padding:clamp(26px,5vw,72px) clamp(20px,6vw,96px);border-bottom:1px solid var(--line);background:linear-gradient(135deg,var(--paper) 0 70%,#eef3ed 100%)}}
    .cover-inner{{width:min(100%,1320px);margin:auto}} .cover-bar{{display:flex;align-items:center;justify-content:space-between;min-height:44px;padding-bottom:18px;border-bottom:1px solid var(--ink)}}
    .wordmark{{font:700 21px var(--font-display)}} .doc-type{{color:var(--muted);font-size:13px;font-weight:700;letter-spacing:.08em}}
    .cover-grid{{display:grid;grid-template-columns:minmax(320px,.9fr) minmax(500px,1.1fr);gap:clamp(44px,7vw,108px);padding-top:clamp(42px,7vh,74px)}}
    .eyebrow{{display:inline-flex;align-items:center;gap:9px;margin-bottom:16px;color:var(--green-dark);font-size:13px;font-weight:800;letter-spacing:.1em}}
    .eyebrow::before{{content:"";width:28px;height:3px;background:var(--green)}} .title-block h1{{max-width:8em;margin-bottom:25px;font:800 clamp(45px,5.4vw,78px)/1.15 var(--font-display);letter-spacing:-.02em}}
    .meta{{margin:0;max-width:520px;border-top:1px solid var(--line)}} .meta-row{{display:grid;grid-template-columns:94px 1fr;gap:14px;padding:9px 0;border-bottom:1px solid var(--line);font-size:14px}} .meta dt{{color:var(--muted)}} .meta dd{{margin:0;font-weight:650}}
    .cover-note{{display:grid;grid-template-columns:38px 1fr;gap:12px;margin-top:22px;padding:18px;border-left:4px solid var(--green);background:var(--soft-green)}} .cover-note .icon{{margin-top:2px;color:var(--green-dark)}} .cover-note strong{{display:block;margin-bottom:4px}} .cover-note p{{margin:0;font-size:14px;line-height:1.65}}
    .directory h2{{margin:0 0 16px;font:700 clamp(27px,3vw,39px)/1.3 var(--font-display)}} .directory ol{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 26px;margin:0;padding:0;list-style:none;border-top:1px solid var(--ink)}}
    .toc-link{{display:grid;grid-template-columns:36px 1fr;align-items:center;min-height:54px;border-bottom:1px solid var(--line);color:var(--ink);text-decoration:none}} .toc-link span{{color:var(--green);font-size:12px;font-weight:900}} .toc-link strong{{font-size:14px}} .toc-link:hover strong{{color:var(--green-dark)}}
    .document-shell{{display:grid;grid-template-columns:230px minmax(0,900px);justify-content:center;gap:clamp(42px,6vw,90px);width:min(100% - 40px,1320px);margin:auto;padding:58px 0 120px}}
    .side-nav{{position:sticky;top:22px;align-self:start;max-height:calc(100vh - 44px);overflow:auto;padding:13px 0;border-top:1px solid var(--ink);border-bottom:1px solid var(--ink)}} .side-title{{margin:0 0 8px;color:var(--muted);font-size:11px;font-weight:800;letter-spacing:.12em}}
    .side-link{{display:grid;grid-template-columns:34px 1fr;align-items:center;min-height:42px;color:var(--ink);font-size:12px;line-height:1.35;text-decoration:none}} .side-link span{{color:var(--green);font-weight:800}}
    .document{{min-width:0}} .chapter{{scroll-margin-top:22px;padding:60px 0 68px;border-top:1px solid var(--ink)}} .chapter:first-child{{padding-top:10px}} .chapter-heading{{display:grid;grid-template-columns:58px 1fr;align-items:baseline;margin-bottom:34px}} .chapter-number{{color:var(--green);font-size:17px;font-weight:900}} .chapter h2{{margin:0;font:750 clamp(30px,3vw,42px)/1.3 var(--font-display)}}
    .chapter h3{{display:flex;gap:12px;align-items:baseline;scroll-margin-top:22px;margin:44px 0 18px;color:var(--deep-green);font-size:22px;line-height:1.45}} .chapter h3 span{{color:var(--green);font-size:12px;font-weight:900}}
    .chapter ul,.chapter ol{{margin:0 0 24px;padding-left:1.35em}} .chapter li{{margin:7px 0;padding-left:.25em}} .chapter li::marker{{color:var(--green-dark);font-weight:800}}
    .callout{{display:grid;grid-template-columns:40px 1fr;gap:12px;margin:28px 0;padding:20px 22px;border:1px solid #bfd0c3;border-left:5px solid var(--green);background:var(--soft-green)}} .callout-icon{{color:var(--green-dark)}} .callout strong{{display:block;margin-bottom:4px}} .callout p{{margin:0;max-width:none}}
    .summary-grid{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:24px 0 34px}} .summary-card{{position:relative;min-height:154px;padding:22px;border:1px solid var(--line);background:rgba(255,255,255,.68)}} .summary-card:nth-child(1),.summary-card:nth-child(4){{background:var(--soft-green)}} .card-index{{position:absolute;top:16px;right:18px;color:rgba(66,140,92,.55);font-size:12px;font-weight:900}} .summary-card h4{{margin:0 0 10px;color:var(--deep-green);font-size:14px}} .summary-card p{{margin:0;font-size:15px;line-height:1.62}}
    .domain-grid{{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:26px 0 34px}} .domain-card{{padding:22px 20px;border-top:5px solid var(--green);background:white;box-shadow:0 8px 26px rgba(22,51,33,.07)}} .domain-card:nth-child(2){{border-top-color:var(--facility)}} .domain-card:nth-child(3){{border-top-color:var(--info)}} .domain-top{{display:flex;align-items:baseline;gap:10px}} .domain-index{{color:var(--green);font-size:12px;font-weight:900}} .domain-card h4{{margin:0;font:700 22px var(--font-display)}} .domain-question{{min-height:52px;margin:12px 0 14px;color:var(--muted);font-size:14px}} .domain-card dl{{margin:0}} .domain-card dl div{{padding:9px 0;border-top:1px solid var(--line)}} .domain-card dt{{color:var(--muted);font-size:11px;font-weight:800}} .domain-card dd{{margin:2px 0 0;font-size:13px}}
    .architecture-viz,.flow-viz{{margin:26px 0 36px;padding:22px;border:1px solid var(--line);background:rgba(255,255,255,.65)}} figure figcaption{{display:flex;align-items:center;gap:10px;margin-bottom:20px;color:var(--deep-green);font-weight:800}} .tree ul{{position:relative;margin:0;padding-left:28px;list-style:none}} .tree>ul{{padding-left:0}} .tree ul ul::before{{content:"";position:absolute;top:0;bottom:18px;left:9px;border-left:1px solid #aebfb2}} .tree li{{position:relative;margin:10px 0;padding-left:0}} .tree ul ul>li::before{{content:"";position:absolute;top:18px;left:-19px;width:19px;border-top:1px solid #aebfb2}} .tree-node{{display:inline-flex;min-height:36px;align-items:center;padding:7px 12px;border:1px solid var(--line);border-radius:8px;background:white;font-size:14px;font-weight:650;box-shadow:0 3px 10px rgba(22,51,33,.04)}} .tree>ul>li>.tree-node{{background:var(--deep-green);color:white;border-color:var(--deep-green);font-size:16px}}
    .flow-lane{{margin-top:18px;padding-top:18px;border-top:1px solid var(--line)}} .flow-lane:first-of-type{{border-top:0;padding-top:0}} .flow-lane h4{{margin:0 0 12px;color:var(--deep-green);font-size:15px}} .flow-lane ol{{display:flex;margin:0;padding:0;list-style:none}} .flow-lane li{{position:relative;display:grid;grid-template-columns:26px 1fr;align-items:start;gap:7px;flex:1;margin:0 12px 0 0;padding:12px 28px 12px 12px;border:1px solid var(--line);border-radius:8px;background:white;font-size:12px;line-height:1.45}} .flow-lane li:not(:last-child)::after{{content:"";position:absolute;z-index:2;right:-10px;top:50%;width:18px;height:18px;border-top:2px solid var(--green);border-right:2px solid var(--green);transform:translateY(-50%) rotate(45deg);background:var(--paper)}} .step-index{{display:flex;width:24px;height:24px;align-items:center;justify-content:center;border-radius:50%;background:var(--soft-green);color:var(--green-dark);font-size:11px;font-weight:900}}
    .roadmap{{position:relative;margin:28px 0 36px}} .roadmap::before{{content:"";position:absolute;top:16px;bottom:18px;left:20px;width:2px;background:#b8c9bc}} .roadmap-item{{position:relative;display:grid;grid-template-columns:42px 1fr;gap:16px;margin:0 0 16px}} .roadmap-marker{{z-index:1;display:flex;width:42px;height:42px;align-items:center;justify-content:center;border-radius:50%;background:var(--deep-green);color:white;font-weight:900}} .roadmap-card{{padding:18px 20px;border:1px solid var(--line);background:white}} .roadmap-heading{{display:flex;gap:15px;align-items:center;justify-content:space-between}} .roadmap-heading h4{{margin:0;color:var(--deep-green);font-size:18px}} .roadmap-heading>span{{color:var(--green-dark);font-size:12px;font-weight:750}} .roadmap-card>p{{margin:8px 0 12px}} .roadmap-card dl{{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:0}} .roadmap-card dl div{{padding-top:8px;border-top:1px solid var(--line)}} .roadmap-card dt{{color:var(--muted);font-size:11px;font-weight:800}} .roadmap-card dd{{margin:3px 0 0;font-size:12px}}
    .table-wrap{{width:100%;margin:26px 0 34px;overflow-x:auto;border-top:2px solid var(--ink);border-bottom:1px solid var(--ink);background:rgba(255,255,255,.55)}} table{{width:100%;border-collapse:collapse;font-size:13px;line-height:1.55}} th,td{{min-width:92px;padding:12px 13px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}} th{{background:var(--paper-deep);color:var(--deep-green);font-weight:800;white-space:nowrap}} tbody tr:nth-child(even){{background:rgba(226,235,229,.28)}} tbody tr:last-child td{{border-bottom:0}} .table-requirements table{{min-width:1300px}} .table-decisions table{{min-width:920px}} .table-delivery-status table{{min-width:850px}}
    .status-pill,.priority-pill{{display:inline-flex;align-items:center;gap:6px;min-height:27px;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:800;white-space:nowrap}} .status-pill>span{{width:7px;height:7px;border-radius:50%;background:currentColor}} .status-confirmed,.status-ready{{color:#276a42;background:#e1f1e6}} .status-pending{{color:#8a5a1f;background:#fff0d8}} .status-demo{{color:#76508f;background:#f0e5f6}} .status-technical{{color:#32657a;background:#e2f0f4}} .status-field{{color:#9a4e2e;background:#f8e7df}} .priority-p0{{color:white;background:var(--facility)}} .priority-p1{{color:var(--deep-green);background:var(--soft-green)}} .priority-p2{{color:var(--muted);background:var(--paper-deep)}}
    .back-to-directory{{display:inline-flex;align-items:center;min-height:44px;margin-top:18px;color:var(--green-dark);font-size:13px;font-weight:750}}
    @media(max-width:1020px){{.cover{{min-height:auto}}.cover-grid{{grid-template-columns:1fr;gap:46px}}.title-block h1{{max-width:11em}}.document-shell{{display:block;width:min(100% - 48px,900px)}}.side-nav{{display:none}}}}
    @media(max-width:700px){{.project-home-link{{top:50%;left:0;width:44px;min-width:44px;height:44px;min-height:44px;padding:0;border-left:0;border-radius:0 14px 14px 0;transform:translateY(-50%);background:rgba(251,247,238,.82);box-shadow:4px 8px 22px rgba(22,51,33,.12)}}.project-home-link span{{display:none}}}}
    @media(max-width:680px){{body{{font-size:16px}}.cover{{padding:20px 18px 48px}}.cover-bar{{padding-bottom:12px}}.doc-type{{max-width:52%;text-align:right;font-size:10px}}.cover-grid{{gap:40px;padding-top:34px}}.title-block h1{{font-size:clamp(40px,13vw,56px)}}.meta-row{{grid-template-columns:80px 1fr;gap:8px}}.directory ol{{grid-template-columns:1fr}}.document-shell{{width:calc(100% - 32px);padding:30px 0 78px}}.chapter{{padding:46px 0 54px}}.chapter-heading{{grid-template-columns:40px 1fr;margin-bottom:26px}}.chapter h2{{font-size:29px}}.chapter h3{{font-size:20px}}.summary-grid,.domain-grid{{grid-template-columns:1fr}}.summary-card{{min-height:auto}}.domain-question{{min-height:0}}.architecture-viz,.flow-viz{{padding:16px}}.flow-lane ol{{display:block}}.flow-lane li{{margin:0 0 10px;padding-right:12px}}.flow-lane li:not(:last-child)::after{{right:auto;left:19px;top:auto;bottom:-8px;transform:rotate(135deg);background:var(--paper)}}.roadmap-card dl{{grid-template-columns:1fr}}.roadmap-heading{{display:block}}.roadmap-heading>span{{display:block;margin-top:4px}}.table-wrap{{width:calc(100vw - 16px);max-width:calc(100vw - 16px)}}th,td{{padding:10px 11px}}}}
    @media(prefers-reduced-motion:reduce){{*{{scroll-behavior:auto!important;transition:none!important}}}}
    @media print{{@page{{size:A4;margin:16mm}}html,body{{background:white}}body{{font-size:10pt;color:#111}}.skip-link,.project-home-link,.side-nav,.back-to-directory{{display:none!important}}.cover{{min-height:auto;padding:0;border:0;break-after:page;background:white}}.cover-grid{{grid-template-columns:1fr;gap:12mm;padding-top:12mm}}.title-block h1{{font-size:36pt}}.directory ol{{grid-template-columns:repeat(2,1fr)}}.document-shell{{display:block;width:100%;padding:0}}.chapter{{padding:8mm 0;break-before:page}}.chapter:first-child{{break-before:auto}}.summary-grid,.domain-grid{{break-inside:avoid}}.table-wrap{{overflow:visible;break-inside:auto}}table{{font-size:7.5pt}}thead{{display:table-header-group}}tr{{break-inside:avoid}}.architecture-viz,.flow-viz,.roadmap-item{{break-inside:avoid}}}}
  </style>
</head>
<body>
  <a class="skip-link" href="#main-content">跳至正文</a>
  <a class="project-home-link" href="../../index.html" aria-label="返回项目首页"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6"></path></svg><span>项目首页</span></a>
  <header class="cover" id="directory" tabindex="-1">
    <div class="cover-inner">
      <div class="cover-bar"><span class="wordmark">零里说</span><span class="doc-type">PRODUCT REQUIREMENTS · PROJECT LEVEL</span></div>
      <div class="cover-grid">
        <div class="title-block">
          <p class="eyebrow">全民友好的居民文化导览</p>
          <h1>{html.escape(document.title.replace('零里说 · ', ''))}</h1>
          <dl class="meta">{metadata}</dl>
          <aside class="cover-note">{icon_svg('info')}<div><strong>{inline_markup(note_label)}</strong><p>{inline_markup(note_content)}</p></div></aside>
        </div>
        <nav class="directory" aria-labelledby="directory-title"><h2 id="directory-title">项目目录</h2><ol>{toc}</ol></nav>
      </div>
    </div>
  </header>
  <div class="document-shell">
    <aside class="side-nav" aria-label="章节导航"><p class="side-title">章节导航</p>{side}</aside>
    <main class="document" id="main-content" tabindex="-1">{render_body(document.blocks)}</main>
  </div>
  <script>
    (function(){{function focusHash(){{if(!location.hash)return;var el=document.getElementById(decodeURIComponent(location.hash.slice(1)));if(el)el.focus({{preventScroll:true}})}}window.addEventListener('hashchange',function(){{requestAnimationFrame(focusHash)}});document.addEventListener('DOMContentLoaded',focusHash)}}());
  </script>
</body>
</html>'''


def build() -> Path:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(build_html(), encoding="utf-8")
    return OUTPUT


if __name__ == "__main__":
    print(build())
