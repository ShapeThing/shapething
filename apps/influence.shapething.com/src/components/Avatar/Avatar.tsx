import "./style.scss";

// Java's String#hashCode, so a name always gets the same color.
const hashCode = (text: string) => {
  let hash = 0;
  for (let index = 0; index < text.length; index++) {
    hash = (text.charCodeAt(index) + ((hash << 5) - hash)) | 0;
  }
  return hash;
};

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter((part) => /^\p{Lu}/u.test(part))
    .map((part) => part[0])
    .slice(0, 3)
    .join("");

/**
 * The initials of a name on a color of its own: the portrait of people without one on Wikidata
 * (see widgets/PortraitViewer).
 */
export default function Avatar({ name }: { name: string }) {
  const hue = Math.abs(hashCode(name)) % 360;
  return (
    <span className="avatar" style={{ backgroundColor: `hsl(${hue} 45% 45%)` }} aria-hidden="true">
      {initialsOf(name)}
    </span>
  );
}
