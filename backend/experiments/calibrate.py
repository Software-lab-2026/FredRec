"""Measures how well the meaning-based (vector) search thresholds separate right from wrong, on the labelled queries
in experiments/queries.yaml, against the database in DATABASE_URL (read only).

    .venv/bin/python -m experiments.calibrate            # writes docs/experiments/results/<date>-calibration.{md,json}
    .venv/bin/python -m experiments.calibrate --label after-model-change

What it measures:
- topic_match_threshold: for each threshold, how many queries resolve to an acceptable topic, to a wrong one, or to
  nothing. Only the meaning step is measured (exact names and aliases are matched before it anyway).
- suggestion_threshold: the highest score of a non-CS query against any topic vs the lowest score of a CS query.
- scraped_match_threshold: for each threshold, how many scraped items relevant queries get, and how many items
  unrelated queries wrongly get.
"""

import argparse
import asyncio
import json
from datetime import UTC, datetime
from pathlib import Path

import yaml
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import get_settings
from app.core.db import get_async_engine
from app.core.embeddings import embed_query
from app.models import Concept, ScrapedItem, Topic
from app.services.matching import _nearest, nearest_topics

HERE = Path(__file__).parent
RESULTS = HERE.parent.parent / "docs" / "experiments" / "results"
TOPIC_THRESHOLDS = [round(0.56 + 0.02 * i, 2) for i in range(13)]  # 0.56 … 0.80
SCRAPED_THRESHOLDS = [round(0.66 + 0.02 * i, 2) for i in range(10)]  # 0.66 … 0.84
SCRAPED_CAP = 20  # items counted per query; search shows at most 6 per site


async def topic_runs(session: AsyncSession, cases: list[dict]) -> list[dict]:
    runs = []
    for case in cases:
        vector = await embed_query(case["query"])
        candidates = await nearest_topics(session, vector) + await _nearest(session, Concept, vector)
        candidates.sort(key=lambda pair: pair[1], reverse=True)
        runs.append(
            {
                "query": case["query"],
                "expect": case["expect"],
                "top": [{"name": item.name, "similarity": round(float(sim), 4)} for item, sim in candidates[:3]],
            }
        )
    return runs


def topic_sweep(runs: list[dict]) -> list[dict]:
    rows = []
    for t in TOPIC_THRESHOLDS:
        right = wrong = missed = rejected_ok = false_match = 0
        for run in runs:
            best = run["top"][0] if run["top"] else None
            matched = best is not None and best["similarity"] >= t
            if run["expect"]:
                if not matched:
                    missed += 1
                elif best["name"] in run["expect"]:
                    right += 1
                else:
                    wrong += 1
            elif matched:
                false_match += 1
            else:
                rejected_ok += 1
        rows.append(
            {"threshold": t, "right": right, "wrong_topic": wrong, "missed": missed,
             "non_cs_rejected": rejected_ok, "non_cs_matched": false_match}
        )
    return rows


async def scraped_runs(session: AsyncSession, cases: list[dict]) -> list[dict]:
    runs = []
    for case in cases:
        vector = await embed_query(case["query"])
        similarity = 1 - ScrapedItem.embedding.cosine_distance(vector)
        top = (
            await session.execute(
                select(ScrapedItem.source, ScrapedItem.title, similarity)
                .where(ScrapedItem.embedding.is_not(None))
                .order_by(similarity.desc())
                .limit(SCRAPED_CAP)
            )
        ).all()
        runs.append(
            {
                "query": case["query"],
                "relevant": case["relevant"],
                "similarities": [round(float(s), 4) for *_, s in top],
                "top": [{"source": src, "title": title, "similarity": round(float(s), 4)} for src, title, s in top[:5]],
            }
        )
    return runs


def scraped_sweep(runs: list[dict]) -> list[dict]:
    rows = []
    for t in SCRAPED_THRESHOLDS:
        relevant = [sum(s >= t for s in r["similarities"]) for r in runs if r["relevant"]]
        unrelated = [sum(s >= t for s in r["similarities"]) for r in runs if not r["relevant"]]
        rows.append(
            {
                "threshold": t,
                "relevant_queries_with_items": sum(n > 0 for n in relevant),
                "relevant_avg_items": round(sum(relevant) / len(relevant), 1) if relevant else 0,
                "unrelated_queries_with_items": sum(n > 0 for n in unrelated),
                "unrelated_items": sum(unrelated),
            }
        )
    return rows


def table(rows: list[dict], current: float) -> str:
    head = list(rows[0])
    lines = ["| " + " | ".join(head) + " |", "|" + "---|" * len(head)]
    for row in rows:
        mark = " ← current" if abs(row["threshold"] - current) < 1e-9 else ""
        lines.append("| " + " | ".join(str(row[h]) for h in head) + mark + " |")
    return "\n".join(lines)


def report(data: dict) -> str:
    s = data["settings"]
    lines = [
        f"# Vector search calibration — {data['date']}" + (f" ({data['label']})" if data["label"] else ""),
        "",
        f"Model `{s['embedding_model']}`. Database: {data['counts']['topics']} topics, {data['counts']['concepts']} "
        f"concepts, {data['counts']['scraped_items']} scraped items. Queries: experiments/queries.yaml.",
        "",
        "## Topic matching (`topic_match_threshold`)",
        "",
        "Each query resolves to its closest topic/concept if the similarity is at least the threshold. Dev queries"
        " may have guided the choices; held-out queries are the fair test.",
        "",
        "### Dev queries",
        "",
        table(data["topic_sweep"], s["topic_match_threshold"]),
        "",
        "### Held-out queries",
        "",
        table(data["heldout_sweep"], s["topic_match_threshold"]) if data["heldout_sweep"] else "(none)",
        "",
        "## Suggestions and dashboard attribution (`suggestion_threshold`)",
        "",
        f"- Highest score of a non-CS query against any topic: **{data['suggestion']['non_cs_max']}** "
        f"(`{data['suggestion']['non_cs_max_query']}`)",
        f"- Lowest best score of a CS query: **{data['suggestion']['cs_min']}** (`{data['suggestion']['cs_min_query']}`)",
        f"- Current setting: {s['suggestion_threshold']}",
        "",
        "## Scraped items (`scraped_match_threshold`)",
        "",
        f"Items counted per query: at most {SCRAPED_CAP}. Search additionally shows items containing the query's words.",
        "",
        table(data["scraped_sweep"], s["scraped_match_threshold"]),
        "",
        "## Per-query detail",
        "",
        "| Query | Expected | Best match | Similarity | Runner-up |",
        "|---|---|---|---|---|",
    ]
    for run in data["topic_runs"] + data["heldout_runs"]:
        top = run["top"] + [{"name": "–", "similarity": ""}] * 2
        ok = "✓" if top[0]["name"] in run["expect"] else ("—" if not run["expect"] else "✗")
        lines.append(
            f"| {run['query']} | {', '.join(run['expect']) or '(nothing)'} | {ok} {top[0]['name']} | "
            f"{top[0]['similarity']} | {top[1]['name']} {top[1]['similarity']} |"
        )
    lines += ["", "| Query | Relevant? | Top scraped items |", "|---|---|---|"]
    for run in data["scraped_runs"]:
        items = "; ".join(f"{i['similarity']} {i['title'][:50]} ({i['source']})" for i in run["top"][:3])
        lines.append(f"| {run['query']} | {'yes' if run['relevant'] else 'no'} | {items} |")
    return "\n".join(lines) + "\n"


async def main(label: str) -> Path:
    settings = get_settings()
    cases = yaml.safe_load((HERE / "queries.yaml").read_text())
    async with async_sessionmaker(get_async_engine())() as session:
        counts = {
            "topics": await session.scalar(select(func.count()).select_from(Topic)),
            "concepts": await session.scalar(select(func.count()).select_from(Concept)),
            "scraped_items": await session.scalar(select(func.count()).select_from(ScrapedItem)),
        }
        topics = await topic_runs(session, cases["topic_matching"])
        heldout = await topic_runs(session, cases.get("topic_matching_heldout", []))
        scraped = await scraped_runs(session, cases["scraped_items"]) if counts["scraped_items"] else []

    best = [(r["top"][0]["similarity"], r["query"]) for r in topics if r["top"]]
    non_cs = [b for b, r in zip(best, topics, strict=True) if not r["expect"]]
    cs = [b for b, r in zip(best, topics, strict=True) if r["expect"]]
    data = {
        "date": datetime.now(UTC).strftime("%Y-%m-%d"),
        "label": label,
        "settings": {
            k: getattr(settings, k)
            for k in ("embedding_model", "topic_match_threshold", "suggestion_threshold",
                      "scraped_match_threshold", "resource_match_threshold")
        },
        "counts": counts,
        "topic_sweep": topic_sweep(topics),
        "heldout_sweep": topic_sweep(heldout) if heldout else [],
        "suggestion": {
            "non_cs_max": max(non_cs)[0], "non_cs_max_query": max(non_cs)[1],
            "cs_min": min(cs)[0], "cs_min_query": min(cs)[1],
        },
        "scraped_sweep": scraped_sweep(scraped) if scraped else [],
        "topic_runs": topics,
        "heldout_runs": heldout,
        "scraped_runs": scraped,
    }
    RESULTS.mkdir(parents=True, exist_ok=True)
    name = f"{data['date']}-calibration" + (f"-{label}" if label else "")
    (RESULTS / f"{name}.json").write_text(json.dumps(data, indent=2, ensure_ascii=False))
    (RESULTS / f"{name}.md").write_text(report(data) if scraped else report({**data, "scraped_sweep": [
        {"threshold": settings.scraped_match_threshold, "note": "no scraped items in this database"}]}))
    return RESULTS / f"{name}.md"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--label", default="", help="added to the file name, e.g. 'bge-base'")
    print(f"Wrote {asyncio.run(main(parser.parse_args().label))}")
