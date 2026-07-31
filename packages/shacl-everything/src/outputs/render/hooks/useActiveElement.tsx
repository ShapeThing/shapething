import { useEffect, useState } from "react";

export default function useActiveElement() {
  const [activeEl, setActiveEl] = useState<Element | null>(null);

  useEffect(() => {
    const handleFocusChange = () => {
      // document.activeElement gives you the currently focused DOM node
      setActiveEl(document.activeElement);
    };

    const handleFocusChangeDebounced = () => {
      setTimeout(handleFocusChange, 0);
    };

    // 'focusin' and 'focusout' bubble up, unlike 'focus' and 'blur'
    document.addEventListener("focusin", handleFocusChange);
    document.addEventListener("focusout", handleFocusChangeDebounced);

    return () => {
      document.removeEventListener("focusin", handleFocusChange);
      document.removeEventListener("focusout", handleFocusChangeDebounced);
    };
  }, []);

  return activeEl;
}
