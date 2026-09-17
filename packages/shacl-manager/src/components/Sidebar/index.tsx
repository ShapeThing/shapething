import fetchClassHierarchy from "./fetchClassHierarchy.rq";
import { useSelect } from "@/hooks/useSelect";

export default function Sidebar() {
  const data = useSelect(fetchClassHierarchy);
  console.log(data);

  return <div>Sidebar content goes here.</div>;
}
