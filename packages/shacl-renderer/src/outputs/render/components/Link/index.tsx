import { type AnchorHTMLAttributes, createContext, type MouseEvent, useContext } from "react";

/** What a link renders with: any attribute of an <a>, its content excluded. */
export type LinkAttributes = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children">;

/**
 * ShaclRenderer's `resolveLink` prop: called for every link the renderer's viewers render, with the
 * href they would link to (a value's IRI, an image's URL, an st:href target). The attributes it
 * returns are put over the viewer's own, so an embedder can point a link somewhere else (a route
 * of its own instead of the IRI), drop `target` to keep it in the page, mark it (`aria-current`,
 * `className`), label it or handle its click. An `onClick` it returns runs before the viewer's own,
 * and can call preventDefault() to stop that too. `undefined` keeps the link as it is.
 */
export type ResolveLink = (href: string) => LinkAttributes | undefined;

/**
 * ShaclRenderer's `resolveLink` prop, for every link below it. Its own context rather than part of
 * the Environment: a new function (e.g. one that marks a different link as current) re-renders only
 * the links, it never rebuilds the form.
 */
export const resolveLinkContext = createContext<ResolveLink | undefined>(undefined);

/**
 * Inside an st:href link (view mode's PropertyUIComponentObject): a link there would be a link
 * inside a link, which HTML does not allow, so Link renders its content without one.
 */
export const insideLinkContext = createContext(false);

type Props = LinkAttributes & { children?: React.ReactNode };

/**
 * The <a> every viewer renders a link with, so that ShaclRenderer's `resolveLink` applies to all of
 * them alike. Inside an st:href link it renders a <span> with the same class instead.
 */
export default function Link({ href, onClick, children, ...attributes }: Props) {
  const resolveLink = useContext(resolveLinkContext);
  const isInsideLink = useContext(insideLinkContext);

  if (isInsideLink) return <span className={attributes.className}>{children}</span>;

  const { onClick: resolvedOnClick, ...resolved } = (href && resolveLink?.(href)) || {};
  const handleClick =
    resolvedOnClick || onClick
      ? (event: MouseEvent<HTMLAnchorElement>) => {
          resolvedOnClick?.(event);
          if (!event.defaultPrevented) onClick?.(event);
        }
      : undefined;

  return (
    <a href={href} {...attributes} {...resolved} onClick={handleClick}>
      {children}
    </a>
  );
}
