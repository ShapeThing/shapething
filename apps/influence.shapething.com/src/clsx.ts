/** Joins the class names that are set. */
export const clsx = (...classNames: Array<string | false | null | undefined>): string =>
  classNames.filter(Boolean).join(" ");
