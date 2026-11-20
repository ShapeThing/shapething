import { useLocation, useNavigate, useResolvedPath } from "react-router";

const openedHere = { openedHere: true };

// A dialog that is open while the URL is `path`. Opened from within the manager, closing goes back
// in history; opened directly (a link, a reload), it goes to `back`.
export function useRouteDialog(path: string, back: string = ".") {
  const location = useLocation();
  const navigate = useNavigate();
  const to = useResolvedPath(path).pathname;
  const backTo = useResolvedPath(back).pathname;
  const open = safeDecode(location.pathname) === safeDecode(to);
  const isOpenedHere = (location.state as typeof openedHere | null)?.openedHere === true;

  return {
    open,
    link: { to, state: openedHere },
    backTo,
    close: () => (isOpenedHere ? navigate(-1) : navigate(backTo, { replace: true })),
    leaveTo: (pathname: string) => navigate(pathname, { replace: true }),
  };
}

export function safeDecode(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}
