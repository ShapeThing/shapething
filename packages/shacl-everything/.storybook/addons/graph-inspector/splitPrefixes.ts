const PREFIX_LINE_PATTERN = /^[ \t]*(?:@prefix|@base|PREFIX|BASE)\b.*\n?/gim;

export const splitPrefixes = (
  text: string,
): { prefixText: string; bodyText: string } => {
  const prefixLines: string[] = [];
  const bodyText = text.replace(PREFIX_LINE_PATTERN, (line) => {
    prefixLines.push(line.replace(/\n$/, ""));
    return "";
  });
  return { prefixText: prefixLines.join("\n"), bodyText: bodyText.trim() };
};
