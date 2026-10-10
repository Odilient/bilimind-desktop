// A small regex highlighter for the code stage (player-design 5.5): comments, strings, numbers, keywords,
// call names. Output is escaped HTML with <span class="tk-*">; good enough for JS, Python and SQL snippets.
import { escapeHtml } from './md.ts';

const KW: Record<string, Set<string>> = {
  javascript: new Set('break case catch class const continue debugger default delete do else export extends false finally for function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while with yield async await'.split(' ')),
  python: new Set('False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield print len range'.split(' ')),
  sql: new Set('select from where group by order having insert into values update set delete create table join left right inner outer on as and or not null is in limit distinct count sum avg min max primary key integer text real'.split(' ')),
};

export function highlight(code: string, language = 'javascript'): string {
  const lang = KW[language] ? language : 'javascript';
  const kw = KW[lang]!;
  const comment = lang === 'python' ? '#[^\\n]*' : lang === 'sql' ? '--[^\\n]*' : '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?(?:\\*\\/|$)';
  const re = new RegExp(`(${comment})|("(?:[^"\\\\\\n]|\\\\.)*"?|'(?:[^'\\\\\\n]|\\\\.)*'?|\`(?:[^\`\\\\]|\\\\.)*\`?)|(\\b\\d+(?:\\.\\d+)?(?:e[-+]?\\d+)?\\b)|([A-Za-z_$][\\w$]*)(\\s*\\()?`, 'g');
  let out = '';
  let last = 0;
  for (let m = re.exec(code); m; m = re.exec(code)) {
    out += escapeHtml(code.slice(last, m.index));
    last = re.lastIndex;
    if (m[1]) out += `<span class="tk-c">${escapeHtml(m[1])}</span>`;
    else if (m[2]) out += `<span class="tk-s">${escapeHtml(m[2])}</span>`;
    else if (m[3]) out += `<span class="tk-n">${escapeHtml(m[3])}</span>`;
    else if (m[4]) {
      const word = m[4];
      const isKw = kw.has(lang === 'sql' ? word.toLowerCase() : word);
      if (isKw) out += `<span class="tk-k">${escapeHtml(word)}</span>`;
      else if (m[5]) out += `<span class="tk-f">${escapeHtml(word)}</span>`;
      else out += escapeHtml(word);
      if (m[5]) out += escapeHtml(m[5]);
    }
    if (m[0].length === 0) re.lastIndex++;
  }
  return out + escapeHtml(code.slice(last));
}
