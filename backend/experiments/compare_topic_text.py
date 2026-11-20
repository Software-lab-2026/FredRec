"""Compares ways of representing topics for meaning-based matching, offline (no database): embeds the seeded topics
each way, then scores the labelled queries in experiments/queries.yaml (dev and held-out sets).

    .venv/bin/python -m experiments.compare_topic_text     # writes docs/experiments/results/<date>-topic-text.{md,json}

Variants:
  A  name + domain + aliases (the representation before 2026-11-22)
  B  A + the topic's syllabus description (data/topic_descriptions.yaml)
  C  one vector per subtopic phrase of the description, plus the name; a topic scores its best phrase
"""

import json
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import yaml

from app.core.embeddings import get_embedder
from app.services.embedding_text import topic_phrases, topic_text

HERE = Path(__file__).parent
DATA = HERE.parent / "data"
RESULTS = HERE.parent.parent / "docs" / "experiments" / "results"
THRESHOLDS = [round(0.56 + 0.02 * i, 2) for i in range(14)]  # 0.56 … 0.82


def load_topics() -> list[dict]:
    seed = yaml.safe_load((DATA / "topics.yaml").read_text())
    about = yaml.safe_load((DATA / "topic_descriptions.yaml").read_text())
    return [
        {"name": t["name"], "domain": d["name"], "aliases": t.get("aliases", []), "about": about.get(t["name"], "")}
        for d in seed
        for t in d["topics"]
    ]


def text_a(t: dict) -> str:
    text = f"{t['name']}. A topic in {t['domain']}."
    return text + (f" Also called: {', '.join(t['aliases'])}." if t["aliases"] else "")


def text_b(t: dict) -> str:
    return topic_text(t["name"], t["about"], t["aliases"])  # what the app embeds for a topic as a whole


def phrases(t: dict) -> list[str]:
    return topic_phrases(t["name"], t["about"], t["aliases"])  # what the app embeds phrase by phrase


def normalise(m: np.ndarray) -> np.ndarray:
    return m / np.linalg.norm(m, axis=1, keepdims=True)


def best_matches(scores: np.ndarray, names: list[str]) -> list[list[tuple[str, float]]]:
    order = np.argsort(-scores, axis=1)[:, :3]
    return [[(names[j], round(float(scores[i, j]), 4)) for j in row] for i, row in enumerate(order)]


def sweep(cases: list[dict], tops: list[list[tuple[str, float]]]) -> list[dict]:
    rows = []
    for t in THRESHOLDS:
        right = wrong = missed = non_cs_matched = 0
        for case, top in zip(cases, tops, strict=True):
            name, score = top[0]
            if case["expect"]:
                if score < t:
                    missed += 1
                elif name in case["expect"]:
                    right += 1
                else:
                    wrong += 1
            elif score >= t:
                non_cs_matched += 1
        rows.append({"threshold": t, "right": right, "wrong_topic": wrong, "missed": missed,
                     "non_cs_matched": non_cs_matched, "non_cs_total": sum(not c["expect"] for c in cases)})
    return rows


def top1_accuracy(cases: list[dict], tops) -> str:
    cs = [(c, t) for c, t in zip(cases, tops, strict=True) if c["expect"]]
    hits = sum(t[0][0] in c["expect"] for c, t in cs)
    return f"{hits}/{len(cs)}"


def table(rows: list[dict]) -> str:
    head = list(rows[0])
    return "\n".join(
        ["| " + " | ".join(head) + " |", "|" + "---|" * len(head)]
        + ["| " + " | ".join(str(r[h]) for h in head) + " |" for r in rows]
    )


def main() -> Path:
    embedder = get_embedder()
    topics = load_topics()
    names = [t["name"] for t in topics]
    queries = yaml.safe_load((HERE / "queries.yaml").read_text())
    sets = {"dev": queries["topic_matching"], "held_out": queries["topic_matching_heldout"]}

    topic_vectors = {
        "A": normalise(np.array(embedder.passages([text_a(t) for t in topics]))),
        "B": normalise(np.array(embedder.passages([text_b(t) for t in topics]))),
    }
    phrase_lists = [phrases(t) for t in topics]
    flat = [p for ps in phrase_lists for p in ps]
    owner = np.array([i for i, ps in enumerate(phrase_lists) for _ in ps])
    phrase_vectors = normalise(np.array(embedder.passages(flat)))

    results: dict = {"date": datetime.now(UTC).strftime("%Y-%m-%d"), "model": type(embedder).__name__, "variants": {}}
    for variant in ("A", "B", "C"):
        results["variants"][variant] = {}
        for set_name, cases in sets.items():
            q = normalise(np.array([embedder.query(c["query"]) for c in cases]))
            if variant == "C":
                per_phrase = q @ phrase_vectors.T
                scores = np.full((len(cases), len(topics)), -1.0)
                for j in range(len(topics)):
                    scores[:, j] = per_phrase[:, owner == j].max(axis=1)
            else:
                scores = q @ topic_vectors[variant].T
            tops = best_matches(scores, names)
            results["variants"][variant][set_name] = {
                "top1_accuracy": top1_accuracy(cases, tops),
                "sweep": sweep(cases, tops),
                "per_query": [{"query": c["query"], "expect": c["expect"], "top": t} for c, t in zip(cases, tops, strict=True)],
            }

    lines = [f"# Topic representation comparison — {results['date']}", "", __doc__.split("Variants:")[1].strip(), ""]
    lines += ["## Top-1 accuracy (CS queries whose closest topic is acceptable, ignoring thresholds)", "",
              "| Variant | dev (36) | held-out |", "|---|---|---|"]
    for v, sets_ in results["variants"].items():
        lines.append(f"| {v} | {sets_['dev']['top1_accuracy']} | {sets_['held_out']['top1_accuracy']} |")
    for v, sets_ in results["variants"].items():
        for set_name, r in sets_.items():
            lines += ["", f"## Variant {v}, {set_name} queries", "", table(r["sweep"])]
    lines += ["", "## Held-out misses for the best variant", ""]
    RESULTS.mkdir(parents=True, exist_ok=True)
    path = RESULTS / f"{results['date']}-topic-text"
    best = max(results["variants"], key=lambda v: int(results["variants"][v]["held_out"]["top1_accuracy"].split("/")[0]))
    for row in results["variants"][best]["held_out"]["per_query"]:
        if row["expect"] and row["top"][0][0] not in row["expect"]:
            lines.append(f"- `{row['query']}` → {row['top'][0][0]} ({row['top'][0][1]}); expected {', '.join(row['expect'])}")
    lines.insert(4, f"Best on held-out queries: **{best}**.\n")
    path.with_suffix(".md").write_text("\n".join(lines) + "\n")
    path.with_suffix(".json").write_text(json.dumps(results, indent=2, ensure_ascii=False))
    return path.with_suffix(".md")


if __name__ == "__main__":
    print(f"Wrote {main()}")
