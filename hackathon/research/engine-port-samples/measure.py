"""Measure one real lesson expansion with the production ExpandNodePrompt text.
Usage: python measure.py <label> '<provider-json-or-empty>' '<reasoning-json-or-empty>'
Prints tokens, cost, provider, latency, block types. Never prints the key."""
import json, os, re, sys, time, urllib.request

PHP = r"C:\oybek\projects\bilimind\backend\app\Services\Llm\Prompts"
src = open(os.path.join(PHP, "ExpandNodePrompt.php"), encoding="utf-8").read()
sup = open(os.path.join(PHP, "PromptSupport.php"), encoding="utf-8").read()

def heredoc_after(text, marker):
    i = text.index(marker)
    m = re.search(r"<<<'?PROMPT'?\n(.*?)\n\s*PROMPT;", text[i:], re.S)
    body = m.group(1)
    lines = body.split("\n")
    indent = min(len(l) - len(l.lstrip()) for l in lines if l.strip())
    return "\n".join(l[indent:] for l in lines)

system = heredoc_after(src, "public function system()")
catalogue = heredoc_after(src, "private function payloadCatalogue()")
rules = heredoc_after(src, "private function assessmentRules()").replace("{$mcqShare}", "40")
house = heredoc_after(sup, "protected function houseStyle()")
grounding = heredoc_after(sup, "protected function groundingRules()")
system = system.replace("{$catalogue}", catalogue).replace("{$assessmentRules}", rules).replace("{$house}", house)

contract = """OUTPUT CONTRACT — non-negotiable:
Reply with ONE JSON object and nothing else. No markdown fences, no commentary,
no trailing text. Keys marked REQUIRED must always be present and non-null.
Use exactly these key names, in this shape:

{
  "blocks": [{
    "type": string one of ["explainer"|"key_points"|"example"|"quiz"|"project"|"flashcards"|"code"|"reflection"|"walkthrough"|"checklist"|"diagram"|"comparison"|"scenario"|"reference_table"|"worked_example"|"playground"|"timeline"|"analogy"|"audio"|"speaking"|"dialogue"|"misconception"],   // REQUIRED
    "payload": { ... },   // REQUIRED — shape is dictated by `type` — see the block payload catalogue
    "source_material_ids": [integer] /* max 12 items */,   // material ids this block was built from; omit when none
    "assessments": [{
      "kind": string one of ["mcq"|"multi_select"|"short_answer"|"cloze"|"essay"|"project"|"code"|"ordering"|"numeric"],   // REQUIRED
      "prompt": string /* min length 10, max length 4000 chars — HARD LIMIT, count them */,   // REQUIRED — the question, standing entirely on its own
      "bloom": string one of ["remember"|"understand"|"apply"|"analyze"|"evaluate"|"create"],   // REQUIRED — cognitive level this item actually demands
      "grader": string one of ["deterministic"|"llm_rubric"|"self"],   // REQUIRED
      "options": [{"id": string, "text": string}] /* min 2, max 8 items */,   // mcq/multi_select/ordering only
      "answer_key": { ... },   // never shown to the learner
      "rubric": [{"criterion": string, "weight": number, "excellent": string, "acceptable": string, "poor": string}] /* min 2, max 4 items */,   // REQUIRED for every llm_rubric item; weights sum to 1
      "max_score": integer /* >= 1, <= 100 */
    }] /* max 8 items */   // only on quiz/exam/project/code blocks
  }] /* min 3, max 12 items */   // REQUIRED
}"""
system = system.strip() + "\n\n" + contract

user = "\n\n".join([
"""LEARNER BRIEF
- Topic as the learner wrote it: Data Structures final exam on Friday; my lecture slides are attached
- Content language: English (BCP-47 tag "en")
- Self-reported level: beginner
- Why they are learning it: Pass the Data Structures final on Friday
- Source of truth: their own attached materials plus your knowledge""",
"""THE NODE YOU ARE WRITING
- Title: How a binary search tree keeps keys in order
- Stable key: bst_ordering
- What this node is for: You will be able to insert keys into a binary search tree by hand and predict its shape. Covers the ordering invariant, insertion, in-order traversal and why a sorted insert degrades to a list. Prevents assuming every BST lookup is O(log n).
- Canonical concept: ds.binary_search_tree
- Study time to fill: 25 focused minutes
- Where it sits: step 3 on the course path (step 1 is where the learner starts)

- ARCHETYPE: `conceptual` — this node is one where the learner has to understand WHY something behaves as it does before any of it makes sense.
- WRITING THIS ARCHETYPE WELL: The diagram carries the mechanism; do not describe in prose what the diagram already shows. The analogy must name where it BREAKS — an analogy without its limit teaches a misconception.
- ASSESSMENT KINDS THAT SUIT IT: short_answer, mcq, essay
- OPTIONAL FORMATS you may add 1–3 of: example, reflection, scenario, misconception, key_points, audio

- MANDATORY FORMATS — every one of these MUST be a block in your reply: explainer, diagram, analogy""",
"""COMES IMMEDIATELY BEFORE THIS NODE (already taught — do not re-teach)
- Trees and their vocabulary — You will be able to name root, leaf, height and depth on any tree.""",
"""COMES AFTER THIS NODE (do not teach it here)
- Balancing with AVL rotations — You will be able to rebalance a tree after an insert.""",
"""RESEARCH RESULTS
The research stage found nothing usable for this node. Do NOT emit a `video`,
`resource` or `annotated_media` block, and do not write a URL of your own to
fill the gap. Teach it entirely from the lesson's own content.""",
grounding + "\n\n" + """MATERIAL EXCERPTS (the learner's own source — cite by material_id)
[material_id=14 · Week 7 - Trees.pdf · Slide 14]
Binary Search Tree (BST): for every node x, all keys in the left subtree < x.key < all keys in the right subtree. Search: compare with root, go left or right. Cost O(h) where h = height.

---

[material_id=15 · Week 7 - Trees.pdf · Slide 15]
Insert 50, 30, 70, 20, 40, 60, 80 -> balanced, h = 2. Insert 10, 20, 30, 40, 50 -> degenerate (a linked list), h = 4. Worst case search O(n).""",
"""Write this node now. Return the JSON object described in the output contract
and nothing else.""",
])

label = sys.argv[1]
provider = json.loads(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2] else None
reasoning = json.loads(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3] else None
body = {"model": "deepseek/deepseek-v4-flash", "temperature": 0.6, "max_tokens": 32768,
        "response_format": {"type": "json_object"}, "usage": {"include": True},
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
if provider: body["provider"] = provider
if reasoning: body["reasoning"] = reasoning
req = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions", data=json.dumps(body).encode(),
    headers={"Authorization": "Bearer " + os.environ["OPENROUTER_API_KEY"], "Content-Type": "application/json",
             "HTTP-Referer": "https://bilimind.com", "X-Title": "BiliMind hackathon measurement"})
t = time.time()
resp = json.load(urllib.request.urlopen(req, timeout=400))
dt = time.time() - t
u = resp.get("usage", {})
out = {"label": label, "provider": resp.get("provider"), "seconds": round(dt, 1), "prompt_tokens": u.get("prompt_tokens"),
       "completion_tokens": u.get("completion_tokens"),
       "reasoning_tokens": (u.get("completion_tokens_details") or {}).get("reasoning_tokens"),
       "cost": u.get("cost"), "finish": resp["choices"][0].get("finish_reason")}
content = resp["choices"][0]["message"].get("content") or ""
try:
    j = json.loads(content[content.index("{"): content.rindex("}") + 1])
    out["blocks"] = [b.get("type") for b in j.get("blocks", [])]
    out["assessments"] = [(a.get("kind"), a.get("bloom")) for b in j.get("blocks", []) for a in (b.get("assessments") or [])]
    out["cites"] = [b.get("source_material_ids") for b in j.get("blocks", [])]
    out["words"] = len(re.findall(r"\w+", content))
    open(os.path.join(os.path.dirname(__file__), f"lesson-{label}.json"), "w", encoding="utf-8").write(json.dumps(j, indent=2, ensure_ascii=False))
except Exception as e:
    out["parse_error"] = str(e)[:200]
print(json.dumps(out))
print("system_chars", len(system), "user_chars", len(user))
