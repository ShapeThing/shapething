import Modal from "../Modal/Modal.tsx";

export default function InfoModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="About this app" onClose={onClose}>
      <div className="info-modal">
        <p>
          The purple bars show how influential each entry is compared to everything else currently
          on screen.
        </p>
        <p>
          Click an image to learn more about an entry. Click a name to open it and see what it
          influenced.
        </p>
        <p>
          All data comes from{" "}
          <a href="https://www.wikidata.org/" target="_blank" rel="noreferrer">
            Wikidata
          </a>{" "}
          and{" "}
          <a href="https://en.wikipedia.org/" target="_blank" rel="noreferrer">
            Wikipedia
          </a>
          .
        </p>
        <p>
          Built with{" "}
          <a
            href="https://github.com/ShapeThing/shapething/tree/main/packages/shacl-renderer"
            target="_blank"
            rel="noreferrer"
          >
            SHACL Renderer
          </a>{" "}
          and{" "}
          <a
            href="https://github.com/ShapeThing/shapething/tree/main/packages/typed-sparql"
            target="_blank"
            rel="noreferrer"
          >
            Typed SPARQL
          </a>
          , two packages by{" "}
          <a href="https://shapething.com" target="_blank" rel="noreferrer">
            ShapeThing
          </a>
          .
        </p>
      </div>
    </Modal>
  );
}
