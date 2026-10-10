"""Measure one compact outline call with the production OutlinePrompt text (+ the HACKATHON edits from engine-port.md)."""
import json, os, re, sys, time, urllib.request

PHP = r"C:\oybek\projects\bilimind\backend\app\Services\Llm\Prompts"
src = open(os.path.join(PHP, "OutlinePrompt.php"), encoding="utf-8").read()
sup = open(os.path.join(PHP, "PromptSupport.php"), encoding="utf-8").read()

def heredoc_after(text, marker, tag="PROMPT"):
    i = text.index(marker)
    m = re.search(r"<<<'?" + tag + r"'?\n(.*?)\n\s*" + tag + ";", text[i:], re.S)
    lines = m.group(1).split("\n")
    indent = min(len(l) - len(l.lstrip()) for l in lines if l.strip())
    return "\n".join(l[indent:] for l in lines)

system = heredoc_after(src, "public function system()")
example = heredoc_after(src, "private function shapeExample()", "JSON")
house = heredoc_after(sup, "protected function houseStyle()")
grounding = heredoc_after(sup, "protected function groundingRules()")

TEST = {
 "procedural": "the learner has to DO a sequence of steps in order, and doing them out of order fails",
 "conceptual": "the learner has to understand WHY something behaves as it does before any of it makes sense",
 "factual": "there is a body of terms, values or standards that must simply be known cold",
 "discriminative": "there are two or more options and the whole skill is knowing which one to reach for",
 "diagnostic": "the learner is handed symptoms and has to work backwards to the cause",
 "quantitative": "there is a formula, a calculation or a model with numbers that must come out right",
 "spatial": "the learner has to know where things sit relative to each other — layout, anatomy, wiring, structure",
 "evolutionary": "the current state only makes sense once you know how it got here, and what it replaced",
 "performance": "the learner builds, delivers or performs the real thing end to end and it gets judged",
 "safety_critical": "getting this wrong injures somebody, destroys equipment, or loses data that does not come back",
 "communicative": "the learner has to produce spoken language and be understood in a real exchange — the skill is in the mouth and ear, not on the page"}
FORMATS = {"procedural": "walkthrough + checklist", "conceptual": "explainer + diagram + analogy", "factual": "flashcards + reference_table",
 "discriminative": "comparison + example", "diagnostic": "scenario + diagram", "quantitative": "worked_example + playground",
 "spatial": "diagram + annotated_media", "evolutionary": "timeline + explainer", "performance": "project + checklist",
 "safety_critical": "checklist + scenario", "communicative": "speaking + dialogue"}
arche = "\n".join(['Pick the archetype whose "true when" description actually fits.', ""] +
    [l for a in TEST for l in (f"`{a}` — true when {TEST[a]}.", f"    the learner will get: {FORMATS[a]}")])
tracks = """`core` — use it when it is one of the numbered topics of the course, and a later topic (or the capstone) genuinely cannot be followed without it.
    the learner is told: "Follow these in order — each one is assumed by the next."
`subtopic` — use it when it hangs off a topic: a sub-skill the topic is made of, a tool or alternative the learner chooses between, or a side lesson worth having beside it. It has its own lesson and is never itself a numbered step.
    the learner is told: "What a step covers. Tied to it with a dotted line; a badge says how to treat it.\""""
marks = """`recommended` — use it when of several options under a topic, this is the one you would tell a mentee to take.
    the learner is told: "Recommended — Our pick — do this one."
`alternative` — use it when it is another option to the recommended one; the learner does ONE of them, not all.
    the learner is told: "Alternative — Pick this or the recommended one, not both."
`anytime` — use it when it can be read at any point without anything else suffering — a curiosity, a history, a niche case.
    the learner is told: "Learn anytime — Order not strict. Come back to it whenever.\""""
system = (system.replace("{$tracks}", tracks).replace("{$marks}", marks).replace("{$archetypes}", arche)
          .replace("{$example}", example).replace("{$maxNote}", "240").replace("{$maxFurther}", "4").replace("{$house}", house))
# HACKATHON compact edits
system = system.replace("You are drawing the SPINE: 10 to 16 topics", "You are drawing the SPINE: 5 to 8 topics")
system = system.replace("plus 3 to 10 side lessons", "plus 2 to 5 side lessons")
system = re.sub(r"A topic is a MILESTONE — a capability big enough.*?put them in the one order they can be learned in\.",
    "A topic is a MILESTONE — a capability big enough that a learner would name it\nwhen asked what they now know — and it is taught in ONE focused sitting of 15 to\n45 minutes. Your job is to choose the milestones and put them in the one order\nthey can be learned in.", system, flags=re.S)
system = re.sub(r" The everyday PARTS of each topic.*?do not list those\.", "", system, flags=re.S)
system = system.replace("Yours must have 10\nto 16 topics.", "Yours must have 5\nto 8 topics.")
system = re.sub(r"This is the topic's OWN framing time.*?by choice\.", "Vary it: a\ndefinitions lesson is not a capstone. Keep the whole spine inside the time the\nlearner has before their deadline; subtopics are spent on top, by choice.", system, flags=re.S)
system = system.replace("Aim for 4 to 6 chapters over the\n  spine, so fourteen topics read as five parts.", "Aim for 2 to 3 chapters over the\n  spine, so eight topics read as three parts.")
system = system.replace("Two to four notes across the course", "One to three notes across the course")
system = system.replace("10–16 topics in studiable order", "5–8 topics in studiable order").replace("3–10\nsubtopics", "2–5\nsubtopics").replace("two to four notes", "one to three notes")
assert "10 to 16" not in system, "unreplaced count"

contract = """OUTPUT CONTRACT — non-negotiable:
Reply with ONE JSON object and nothing else. No markdown fences, no commentary,
no trailing text. Keys marked REQUIRED must always be present and non-null.
Use exactly these key names, in this shape:

{
  "course_title": string /* min length 4, max length 120 chars — HARD LIMIT, count them */,   // REQUIRED — in the course language
  "allows_code": boolean,   // REQUIRED — true only if this subject is genuinely about writing/reading code (a programming language, web/software dev, SQL, data science in code, algorithms); false for everything else, including subjects that merely involve numbers or steps
  "nodes": [{
    "key": string /* min length 2, max length 64 chars — HARD LIMIT, count them */,   // REQUIRED — unique snake_case English slug; branch_of and after_key reference this
    "title": string /* min length 3, max length 90 chars — HARD LIMIT, count them */,   // REQUIRED
    "summary": string /* min length 40, max length 500 chars — HARD LIMIT, count them */,   // REQUIRED — 2-3 sentences: capability, coverage, pitfall
    "concept_key": string /* min length 2, max length 64 chars — HARD LIMIT, count them */,   // REQUIRED — language-agnostic English canonical concept id
    "section": string /* max length 60 chars — HARD LIMIT, count them */,   // on the FIRST topic of a chapter only: the chapter it opens
    "note": string /* max length 240 chars — HARD LIMIT, count them */,   // topics only, optional: a sentence or two of advice a mentor would say at this point
    "track": string one of ["core"|"subtopic"],   // REQUIRED — core = a topic on the spine; subtopic = hangs off one with a dotted line
    "branch_of": string /* max length 64 chars — HARD LIMIT, count them */,   // required unless track is core: the key of the topic (or, once, the subtopic) this hangs off
    "mark": string one of ["recommended"|"alternative"|"anytime"],   // subtopics only, optional: the badge — recommended, alternative, or anytime
    "group": string /* max length 60 chars — HARD LIMIT, count them */,   // subtopics only, optional: the family name shared by three or more siblings drawn in one headed box
    "archetype": string one of ["procedural"|"conceptual"|"factual"|"discriminative"|"diagnostic"|"quantitative"|"spatial"|"evolutionary"|"performance"|"safety_critical"|"communicative"],   // REQUIRED — the kind of knowledge this lesson teaches; determines its formats
    "estimated_minutes": integer /* >= 10, <= 90 */   // REQUIRED
  }] /* min 7, max 14 items */,   // REQUIRED — the topics in study order, each immediately followed by the subtopics hanging off it
  "further": [{"title": string, "topic": string, "after_key": string}] /* max 4 items */   // courses worth starting after this one; empty when none would help
}"""
system = system.strip() + "\n\n" + contract

digest = """### Material #1 — "Week 7 - Trees.pdf" (slide deck)
[Slide 3] Tree terminology: root, parent, child, leaf, sibling, depth of a node = edges from root, height of tree = max depth.
[Slide 9] Traversals: preorder (N L R), inorder (L N R), postorder (L R N), level-order uses a queue.
[Slide 14] Binary Search Tree (BST): for every node x, all keys in the left subtree < x.key < all keys in the right subtree. Search: compare with root, go left or right. Cost O(h).
[Slide 15] Insert 50, 30, 70, 20, 40, 60, 80 -> balanced, h = 2. Insert 10, 20, 30, 40, 50 -> degenerate, h = 4. Worst case O(n).
[Slide 18] Delete: leaf -> remove; one child -> splice; two children -> replace with inorder successor.
[Slide 22] AVL tree: balance factor = height(left) - height(right) in {-1, 0, 1}. Rotations: LL, RR, LR, RL.
### Material #2 — "Week 8 - Heaps.pdf" (slide deck)
[Slide 4] Binary heap: complete binary tree stored in an array. Parent of i is (i-1)//2; children 2i+1, 2i+2.
[Slide 7] Insert: append then sift up. Extract-min: move last to root then sift down. Both O(log n).
[Slide 11] Heapsort: build-heap O(n), then n extract-max -> O(n log n), in place, not stable.
[Slide 13] Priority queue applications: Dijkstra, event simulation, top-k."""

user = "\n\n".join([
"""LEARNER BRIEF
- Topic as the learner wrote it: I have my Data Structures final on Friday, my slides are in this folder (trees and heaps)
- Content language: English (BCP-47 tag "en")
- Self-reported level: beginner
- Why they are learning it: Pass the Data Structures final exam on Friday 17 October
- Time budget: 90 minutes per day
- Deadline: 2026-10-17 — everything must be studiable before this date
- Source of truth: their own attached materials plus your knowledge""",
grounding + "\n\nMATERIAL SAMPLE (a spread across everything the learner attached)\n" + digest + """

Because the learner attached their own material, the outline must cover what
is actually in it: mirror its terminology and its structure, and give the
topics it spends the most space on the most lessons. Add lessons for the
prerequisites the material assumes but never explains, and put them at the
start of the path.""",
"""Design the roadmap now. Order the spine the way the subject actually has to
be learned, choose topics big enough to be worth breaking down later, hang
the genuinely-beside-the-path lessons off them with the right badge, say the
two or three things a mentor would say along the way, classify each lesson by
the kind of knowledge it really is, end on a capstone worth doing, and point
at where to go next only if it will help. Return the JSON object described in
the output contract and nothing else."""])

provider = json.loads(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1] else None
body = {"model": "deepseek/deepseek-v4-flash", "temperature": 0.6, "max_tokens": 32768,
        "response_format": {"type": "json_object"}, "usage": {"include": True},
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
if provider: body["provider"] = provider
if len(sys.argv) > 2 and sys.argv[2]: body["reasoning"] = json.loads(sys.argv[2])
req = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions", data=json.dumps(body).encode(),
    headers={"Authorization": "Bearer " + os.environ["OPENROUTER_API_KEY"], "Content-Type": "application/json",
             "HTTP-Referer": "https://bilimind.com", "X-Title": "BiliMind hackathon measurement"})
t = time.time()
resp = json.load(urllib.request.urlopen(req, timeout=400))
dt = time.time() - t
u = resp.get("usage", {})
out = {"provider": resp.get("provider"), "seconds": round(dt, 1), "prompt_tokens": u.get("prompt_tokens"),
       "completion_tokens": u.get("completion_tokens"), "reasoning_tokens": (u.get("completion_tokens_details") or {}).get("reasoning_tokens"),
       "cost": u.get("cost"), "finish": resp["choices"][0].get("finish_reason")}
content = resp["choices"][0]["message"].get("content") or ""
try:
    j = json.loads(content[content.index("{"): content.rindex("}") + 1])
    open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "outline-test.json"), "w", encoding="utf-8").write(json.dumps(j, indent=2, ensure_ascii=False))
    out["title"] = j.get("course_title"); out["allows_code"] = j.get("allows_code")
    out["nodes"] = [(n.get("track"), n.get("archetype"), n.get("title")) for n in j.get("nodes", [])]
except Exception as e:
    out["parse_error"] = str(e)[:200]
print(json.dumps(out, ensure_ascii=True))
print("system_chars", len(system))
