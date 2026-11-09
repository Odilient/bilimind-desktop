/* BiliMind · Daylight 2 course — the content. Psychology 101, "today" is Mon 9 Nov 2026 (see EXAMPLE.md). */
window.DATA = (() => {
  const PEOPLE = {
    madina: ['Madina Karimova', 'MK', 'hi'], aziz: ['Aziz Rashidov', 'AR', 'sky'], lola: ['Lola Usmonova', 'LU', 'rose'],
    timur: ['Timur Aliev', 'TA', 'leaf'], sara: ['Sara Nazarova', 'SN', 'lilac'], jamshid: ['Jamshid Tursunov', 'JT', 'apricot'], rahimova: ['Dr. Rahimova', 'DR', 'ink'],
  };

  /* status: checked = passed a check from memory, done = read, learning, todo */
  const GROUPS = [
    { n: 'Part 1', t: 'How the mind takes things in', ids: ['what', 'brain', 'sense', 'attn'] },
    { n: 'Part 2', t: 'Memory and learning', ids: ['mem', 'forget', 'learn', 'sleep'] },
    { n: 'Part 3', t: 'What moves us', ids: ['emo', 'motiv'] },
    { n: 'Part 4', t: 'People across a life', ids: ['grow', 'pers', 'social', 'stress'] },
  ];
  const T = [
    { id: 'what', t: 'What psychology studies', s: 'checked', min: 20, lec: 1, ch: '1', i: 'flask-conical', when: 'Checked from memory on 5 Oct', can: 'Tell a claim backed by evidence from one backed by common sense.', subs: [['Research methods', 'rec', 'l'], ['A short history', 'any', 'r']] },
    { id: 'brain', t: 'The brain in one lesson', s: 'checked', min: 25, lec: 2, ch: '2', i: 'brain', when: 'Checked from memory on 12 Oct', can: 'Say what the main parts of the brain do and how neurons pass a signal.', subs: [['Neurons and synapses', 'rec', 'l'], ['Brain imaging', 'any', 'r']] },
    { id: 'sense', t: 'Sensation and perception', s: 'checked', min: 25, lec: 3, ch: '6', i: 'eye', when: 'Checked from memory on 19 Oct', can: 'Explain why two people can see the same thing differently.', subs: [['Visual illusions', 'rec', 'l'], ['Signal detection', 'alt', 'r']] },
    { id: 'attn', t: 'Attention', s: 'checked', min: 20, lec: 4, ch: '3', i: 'scan-eye', when: 'Checked from memory on 26 Oct', can: 'Explain why multitasking costs you, with a study to back it up.', subs: [['Selective attention', 'rec', 'l'], ['Multitasking', 'rec', 'r']] },
    { id: 'mem', t: 'How memory works', s: 'done', min: 25, lec: 5, ch: '8', i: 'archive', when: 'Read on 31 Oct. Its check opens Thursday', can: 'Walk a memory through encoding, storage and retrieval.', subs: [['Encoding, storage, retrieval', 'rec', 'l'], ['Working memory', 'rec', 'r']] },
    { id: 'forget', t: 'Why we forget', s: 'learning', min: 20, lec: 6, ch: '8', i: 'cloud-fog', cur: true, when: 'Started Saturday. You stopped at the three reasons', can: 'Explain the forgetting curve and the three reasons we forget, and plan reviews around them.', subs: [['The forgetting curve', 'rec', 'l'], ['Interference', 'rec', 'l'], ['Mnemonics', 'alt', 'r'], ['False memories', 'any', 'r']] },
    { id: 'learn', t: 'Learning and conditioning', s: 'todo', min: 25, lec: 7, ch: '7', i: 'bell', can: 'Tell classical from operant conditioning with an everyday example of each.', subs: [['Classical conditioning', 'rec', 'l'], ['Operant conditioning', 'rec', 'r']] },
    { id: 'sleep', t: 'Sleep and dreams', s: 'todo', min: 20, lec: 8, ch: '3', i: 'moon', can: 'Describe a night’s sleep cycle and why sleep matters for memory.', subs: [['Sleep stages', 'rec', 'l'], ['Sleep and memory', 'any', 'r']] },
    { id: 'emo', t: 'Emotion', s: 'todo', min: 20, lec: 9, ch: '12', i: 'smile', can: 'Compare the main theories of where emotions come from.', subs: [['Theories of emotion', 'rec', 'l'], ['Reading faces', 'alt', 'r']] },
    { id: 'motiv', t: 'Motivation', s: 'todo', min: 20, lec: 9, ch: '11', i: 'flame', can: 'Explain why rewards can sometimes make people less interested.', subs: [['Hunger and drives', 'rec', 'l'], ['Intrinsic and extrinsic', 'rec', 'r']] },
    { id: 'grow', t: 'Growing up: childhood to old age', s: 'todo', min: 25, lec: 10, ch: '5', i: 'baby', can: 'Describe how thinking and relationships change from infancy to old age.', subs: [['Piaget’s stages', 'rec', 'l'], ['Attachment', 'rec', 'r']] },
    { id: 'pers', t: 'Personality', s: 'todo', min: 20, lec: 11, ch: '14', i: 'fingerprint', can: 'Describe someone with the Big Five, and say what the traits can’t tell you.', subs: [['The Big Five', 'rec', 'l'], ['Freud, briefly', 'alt', 'r']] },
    { id: 'social', t: 'Social influence', s: 'todo', min: 25, lec: 12, ch: '13', i: 'users', can: 'Explain conformity, obedience and the bystander effect with the studies behind them.', subs: [['Conformity and obedience', 'rec', 'l'], ['The bystander effect', 'any', 'r']] },
    { id: 'stress', t: 'Stress and health', s: 'todo', min: 20, lec: 12, ch: '12', i: 'heart-pulse', can: 'Explain how long-term stress affects the body, and what helps.', subs: [['Stress and the body', 'rec', 'l'], ['Coping', 'rec', 'r']] },
  ];
  /* notes pinned beside the path, roadmap.sh style */
  const ROAD_NOTES = {
    forget: { side: 'r', i: 'flag', c: 'rose', t: 'Quiz 2 covers topics 5 and 6', s: 'Thu 12 Nov, in the seminar · 10%' },
    attn: { side: 'l', i: 'trophy', c: 'leaf', t: 'Quiz 1 marked: 8 of 10', s: 'Topics 1 to 4 · 2 Nov' },
    stress: { side: 'r', i: 'graduation-cap', c: 'sky', t: 'Final exam', s: 'Fri 11 Dec, 09:30, Main Hall · 50%' },
  };
  const BADGE = { rec: ['Recommended', 'var(--leaf)'], alt: ['Alternative', 'var(--apricot)'], any: ['Learn anytime', 'var(--sky)'] };
  const STATUS = { checked: 'Checked from memory', done: 'Read', learning: 'Learning', todo: 'Not started' };

  const NOTES = {
    l6: { title: 'Lecture 6 notes', meta: 'Tue 3 Nov · Lecture 6 · B-302', html: `
      <p>Rahimova opened with a show of hands: who remembers last week’s lecture? Hardly anyone. Then she put up the forgetting curve.</p>
      <h3>What she stressed</h3>
      <ul><li>Forgetting is fastest in the first day. Review within 24 hours.</li><li>Interference is worst between similar things. Don’t learn two similar topics back to back.</li><li>Feeling familiar isn’t the same as knowing. Test yourself.</li></ul>
      <blockquote contenteditable="false">“If it feels easy when you reread it, that’s exactly why it won’t be there in the exam.”<small data-who="rahimova">Dr. Rahimova, 10:41</small></blockquote>
      <h3>Before Thursday</h3>
      <div class="todo done"><span class="box" contenteditable="false"><i data-lucide="check"></i></span><span>Re-read slides 12 to 16</span></div>
      <div class="todo"><span class="box" contenteditable="false"><i data-lucide="check"></i></span><span>Seminar 5 reading: Roediger &amp; Karpicke</span></div>
      <div class="todo"><span class="box" contenteditable="false"><i data-lucide="check"></i></span><span>Essay 1 outline, 1,500 words on a memory study</span></div>
      <div class="todo done"><span class="box" contenteditable="false"><i data-lucide="check"></i></span><span>Redraw the forgetting curve on the board</span></div>
      <div class="files" contenteditable="false">
        <button class="file" data-toast="Lecture 6: Memory.pdf opens beside the notes"><span class="ft pdf">PDF</span><span><b>Lecture 6: Memory.pdf</b><small>24 pages · from Moodle</small></span><span class="src" data-logo-k="moodle"></span></button>
        <button class="file" data-toast="Crash Course Psychology #13 opens in a side player"><span class="ft yt" data-logo-k="youtube"></span><span><b>Crash Course Psychology #13</b><small>YouTube · shared by Aziz</small></span><span class="src" data-who="aziz"></span></button>
      </div>` },
    studies: { title: 'Key studies to know', meta: 'Updated Thursday · for the final', html: `
      <h3>Memory</h3>
      <ul><li><b>Ebbinghaus (1885)</b>: the forgetting curve, from lists of nonsense syllables.</li><li><b>Bartlett (1932)</b>: people retold a strange story so it fitted what they expected.</li><li><b>Loftus &amp; Palmer (1974)</b>: hearing “smashed” instead of “hit” made people recall higher speeds.</li><li><b>Godden &amp; Baddeley (1975)</b>: divers recalled words best in the place they learned them.</li><li><b>Roediger &amp; Karpicke (2006)</b>: testing yourself beat rereading a week later.</li></ul>
      <h3>Attention</h3>
      <ul><li><b>Simons &amp; Chabris (1999)</b>: about half the viewers missed the gorilla.</li></ul>
      <h3>Social influence</h3>
      <ul><li><b>Asch (1951)</b>: going along with a group’s clearly wrong answer.</li><li><b>Milgram (1963)</b>: obeying an authority further than people expected.</li></ul>` },
  };

  /* sources the assistant and the lesson cite */
  const SRC = {
    s12: ['Lecture 6, slide 12', 'file'], s14: ['Lecture 6, slide 14', 'file'], s18: ['Lecture 6, slide 18', 'file'],
    lcurve: ['This lesson · The forgetting curve', 'book-open', 's1'], ltry: ['This lesson · Try it', 'book-open', 'stry'], lreasons: ['This lesson · Three reasons we forget', 'book-open', 'sreasons'],
    myers8: ['Myers & DeWall, ch. 8', 'book-open'], sem5: ['Seminar 5 reading', 'file-text'], murre: ['Murre & Dros (2015), PLoS ONE', 'external-link'], dl: ['Psychology 101 · Deadlines', 'calendar-days'],
  };
  const ACTS = {
    cards: ['layers', 'Make 6 flashcards from this', '6 flashcards added to Practice, due tomorrow'],
    note: ['notebook-pen', 'Add to Lecture 6 notes', 'Added to Lecture 6 notes'],
    cal: ['calendar-plus', 'Put the reviews on my calendar', '3 reviews on your calendar: Tue, next Mon, 7 Dec'],
    check: ['list-checks', 'Start the check', 'Check started: 3 questions, no notes'],
  };
  const CONV = {
    title: 'Proactive or retroactive interference?',
    msgs: [
      { u: 'What’s the difference between proactive and retroactive interference?', q: 'Proactive interference means old learning blocks new learning; retroactive interference means new learning pushes out old.' },
      { b: `<p>Proactive works forwards: old learning gets in the way of new, like writing last year’s date in January. Retroactive works backwards: new learning pushes out old, like a new phone number making the old one hard to recall <sup data-src="s14">1</sup>.</p><p>A way to keep them apart: <b>pro</b> means before, so the trouble comes from what you learned before. <b>Retro</b> means back, so the new reaches back and disturbs the old.</p><p>Both get worse when the two things are similar, which is why spacing similar topics apart helps <sup data-src="lreasons">2</sup>.</p>`,
        src: ['s14', 'lreasons'], acts: ['cards', 'note'], follow: ['Test me with a scenario', 'How do I stop it happening?', 'Explain it simpler'] },
    ],
  };
  const ANSWERS = [
    { k: /check|quiz me|3-question|three question/i, src: ['lcurve', 'lreasons'], acts: ['check'], follow: ['Make it harder', 'Only interference'], b: `<p>Three questions from this lesson. Answer each from memory before you look anything up <sup data-src="lcurve">1</sup>:</p><ol><li>Ebbinghaus relearned a list faster a day later. What does that tell you he still had?</li><li>You keep typing your old locker code. Proactive or retroactive interference?</li><li>You have two reviews before Thursday’s quiz. When should the first one be?</li></ol><p>I’ll mark them against the lesson and say exactly what was missing <sup data-src="lreasons">2</sup>.</p>` },
    { k: /scenario|test me/i, src: [], acts: [], follow: ['Show me the answer'], b: `<p>Try this one without scrolling up.</p><p>Aziz moved flat in October. Now, when someone asks for his address, he sometimes gives the old one. Which kind of interference is that, and why?</p><p>Answer in your own words and I’ll tell you what you got and what you missed.</p>` },
    { k: /stop|prevent|avoid/i, src: ['lreasons', 's18'], acts: ['note'], follow: ['Test me with a scenario'], b: `<p>Three things help most <sup data-src="lreasons">1</sup>:</p><ul><li>Space similar topics apart, so two similar lists don’t share an evening.</li><li>Test yourself instead of rereading, so each memory gets its own route back.</li><li>Sleep after studying. It protects what you learned that day from what comes next <sup data-src="s18">2</sup>.</li></ul>` },
    { k: /simpl|easier|plain/i, src: ['lreasons'], acts: [], follow: ['Test me with a scenario'], b: `<p>Old gets in the way of new: proactive. New gets in the way of old: retroactive. Just ask which direction the trouble travels <sup data-src="lreasons">1</sup>.</p>` },
    { k: /curve|ebbinghaus|review|spac|when should|hold/i, src: ['murre', 'ltry'], acts: ['cal'], follow: ['Plan my reviews for the quiz'], b: `<p>Broadly, yes, it holds. In 2015 Murre and Dros repeated the experiment and got a very similar curve <sup data-src="murre">1</sup>.</p><p>Each review lifts the curve back up and makes it fall more slowly. A simple plan for Thursday: review tomorrow, then the night before. Move the review days in the lesson’s “Try it” and watch what reaches exam day <sup data-src="ltry">2</sup>.</p>` },
    { k: /[\s\S]*/, src: ['lreasons', 's14'], acts: [], follow: ['Test me with a scenario', 'Explain it simpler'], b: `<p>From this lesson and Lecture 6: memories fade fastest in the first day, and most forgetting comes from three things: decay, interference and missing cues <sup data-src="lreasons">1</sup>.</p><p>Ask me about any of them, or paste a question you expect on Thursday and we’ll work through it <sup data-src="s14">2</sup>.</p>` },
  ];

  const INBOX = [
    { who: 'lola', t: 'Essay 1 extended to Friday 13 Nov', s: 'Lola saw it in the class chat. It stays tentative until it’s on Moodle or you confirm.', act: true },
    { logo: 'gmail', t: 'Quiz 2 moved to Thu 12 Nov', s: 'From Dr. Rahimova’s email. Added to your week and to Deadlines.' },
  ];

  return { PEOPLE, GROUPS, T, ROAD_NOTES, BADGE, STATUS, NOTES, SRC, ACTS, CONV, ANSWERS, INBOX };
})();
