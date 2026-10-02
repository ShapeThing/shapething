// The storybook fixtures keep shapes and instance data together in one Turtle file, while the
// playground has a separate editor for each. This splits such a file at its top-level statements,
// keeping each statement's own leading comments with it: shape declarations go to the shapes half,
// everything else (instances, vocabulary, enumerations) to the data half, and directives to both.

const SHAPE_PATTERN =
  /(?:\bsh:|<http:\/\/www\.w3\.org\/ns\/shacl#)(?:NodeShape|PropertyShape|PropertyGroup|property|path|targetClass|targetNode|targetWhere|targetSubjectsOf|targetObjectsOf)\b/;
const DIRECTIVE_PATTERN = /^\s*(?:@prefix|@base|prefix\s|base\s)/i;

type Statement = { comments: string; code: string };

// Walks the text once, tracking IRIs, strings, comments and bracket depth, so that only a `.` that
// really terminates a top-level statement ends one (not one inside an IRI, string or literal).
function statements(text: string): Statement[] {
  const result: Statement[] = [];
  let comments = "";
  let code = "";
  let depth = 0;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (char === "#") {
      const end = text.indexOf("\n", i);
      const comment = text.slice(i, end === -1 ? text.length : end + 1);
      if (code.trim()) code += comment;
      else comments += comment;
      i += comment.length;
      continue;
    }

    if (char === "<") {
      const end = text.indexOf(">", i);
      code += text.slice(i, end + 1);
      i = end + 1;
      continue;
    }

    if (char === '"' || char === "'") {
      const quote = text.startsWith(char.repeat(3), i) ? char.repeat(3) : char;
      let end = i + quote.length;
      while (end < text.length && !text.startsWith(quote, end)) end += text[end] === "\\" ? 2 : 1;
      code += text.slice(i, end + quote.length);
      i = end + quote.length;
      continue;
    }

    if (char === "[" || char === "(") depth++;
    if (char === "]" || char === ")") depth--;

    if (!code.trim()) {
      // Whitespace between statements belongs with the comments preceding the next one.
      if (/\s/.test(char)) {
        comments += char;
        i++;
        continue;
      }
    }

    code += char;
    i++;

    if (char === "." && depth === 0 && (i === text.length || /[\s#]/.test(text[i]))) {
      result.push({ comments, code });
      comments = "";
      code = "";
    }
  }

  if (code.trim() || comments.trim()) result.push({ comments, code });
  return result;
}

export function splitTurtle(text: string): { shapes: string; data: string } {
  let shapes = "";
  let data = "";

  for (const { comments, code } of statements(text)) {
    if (DIRECTIVE_PATTERN.test(code)) {
      shapes += comments + code;
      data += (data ? "\n" : "") + code.trim();
    } else if (SHAPE_PATTERN.test(code)) {
      shapes += comments + code;
    } else {
      data += comments + code;
    }
  }

  return { shapes: shapes.trim() + "\n", data: data.trim() + "\n" };
}
