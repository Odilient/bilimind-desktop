# Planning: what to keep, what to cut, in what order

Read this before `plan`. You decide; `plan` does the arithmetic, dates the reviews backwards from the
exam and writes `plan.md`. Your reasons appear in `plan.md`, `REPORT.md` and the course, so write them
for the student, in one concrete sentence each.

## 1. Capacity

- Study days = whole days from today up to the day before the exam (or the first shift). A Wednesday
  09:00 exam seen on Sunday gives 3 days (Sun, Mon, Tue). "Tomorrow" gives 1.
- Capacity = days x minutes per day. Each kept lesson also earns 1-4 spaced reviews of 5 min, and
  `plan` packs every day so lessons plus that day's reviews stay within the daily minutes.
  Example: 3 x 45 = 135 min; real outline lessons are 25-40 min (`plan` clamps a lesson to 70% of a day),
  so 30 + 25 + 30 + 25 = 110 min of lessons plus their reviews is about the limit: keep 3-4.
- Lesson minutes come from `outline` (`minutes`). Rank topics by marks per minute (a subtopic brings its
  parent along). At most 6 lessons (6 Writers). 1 day: 1-2 lessons. A week of 20 min/day: 4-5 short ones.
- Cut a lesson and run `plan` again ONLY when a warning says "more than the whole ... Cut a lesson" or
  "over the daily N min". The other warnings (thin sources, variety, a cut topic with marks) are advice:
  mention them in the plan summary.

## 2. Weight

- With a past paper: weight = the share of marks each topic gets in `exam-map` (`weights[].share`).
  Check `crew/exam-map.md` first: a question about hashing matched to "arrays" skews everything, so fix
  it with `--assign "Q2=<key>"`. Questions that match nothing stay unmatched; mention them.
- Without a past paper: weight by how much of the slides a topic covers and by its track (`core` beats
  `subtopic`). Record the assumption: `--assume "No past paper found; topics weighted by slide coverage"`.
- Staff onboarding: weight by risk, not by pages. `safety_critical` topics (allergens, hygiene, cash,
  equipment) come first, then `procedural` (making the product, opening and closing), then `factual`
  (menu codes, prices). Use the SOP's pass mark if it states one.
- Language course: `communicative` topics (speaking, dialogue) first, then `factual` (numbers, food).

## 3. What to cut first

1. Topics with no marks in the past paper (when a paper exists).
2. Subtopics whose parent topic is cut.
3. Thin topics (`thin: true`, little source text): cut them, unless they carry real marks; then keep
   and say "thin source: few slides cover this".
4. Advanced extensions of a kept topic that the paper never asks about (AVL rotations when the paper
   only asks BST insert, traversal and delete).
5. Still over: the lowest weight per minute.

Never cut: the two highest-weighted topics; a prerequisite of a kept topic (the outline order and
`parent` tell you); a safety-critical topic in a staff course.

## 4. Order

`--order`: prerequisites first (outline order), then the highest weight as early as possible, so the
most marks are learned before the most reviews. Keep related topics adjacent.

## 5. Archetype variety

`plan` warns when the kept set is all one kind of knowledge (for example all conceptual). That is a
warning, not a block: if the past paper says so, keep the set and log why with
`bm note --text "Kept 3 conceptual lessons: they carry 75% of the marks"`.

## 6. Good cut reasons (copy the style)

- `avl_trees=No question in last year's paper; 3 days allow 4 lessons`
- `linked_lists=Only 10% of the marks and covered by the arrays lesson`
- `recursion=Thin source: one slide; not on the past paper`
- `pricing=Staff use the till's price list; day one needs allergens and drinks first`

## 7. What plan.md shows (written by `plan`, you only check it)

Assumptions; the past-paper weights table (topic, marks, share, questions); kept lessons with their
day and minutes; cut topics with reasons; the day-by-day schedule; review dates counted backwards from
the exam (exam minus 1, 3 and 7 days, plus the day after learning).
