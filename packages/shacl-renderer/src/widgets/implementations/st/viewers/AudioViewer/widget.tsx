import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { valueNodeLabel } from "@/resolution/label.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import Link from "@/outputs/render/components/Link/index.tsx";
import "./style.css";

/**
 * An audio file URL as the browser's own audio player. Only the metadata (the duration) loads up
 * front; the file itself loads when played. A browser that can't play it shows a link to the file.
 */
export default function AudioViewer({ shape, term }: WidgetProps) {
  const { activeLanguage } = useContentLanguage();
  const label = valueNodeLabel({ term, propertyShape: shape, languages: [activeLanguage] }).value;

  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption -- the value is only the file; there is no captions file to point a <track> at
    <audio
      className="st-audio-viewer"
      src={term.value}
      controls
      preload="metadata"
      aria-label={label}
    >
      <Link href={term.value} target="_blank" rel="noopener noreferrer">
        {label}
      </Link>
    </audio>
  );
}
