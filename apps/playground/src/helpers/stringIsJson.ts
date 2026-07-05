import { parse } from "comment-json";

export const stringIsJson = (input: string) => {
  try {
    parse(input);
    return true;
  } catch {
    return false;
  }
};
