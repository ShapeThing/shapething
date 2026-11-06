import Modal from "../Modal/Modal.tsx";

export default function InfoModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="About this app" onClose={onClose}>
      <div className="info-modal">
        <p>
          The purple bars show the relative influence of a person compared to all the others
          currently shown in the app.
        </p>
        <p>
          Click on the photo of a person to see more about them. Click on the name to open the
          person and see who they influenced.
        </p>
        <p>
          The data comes from{" "}
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
          This application uses{" "}
          <a href="https://github.com/ShapeThing/shapething/tree/main/packages/shacl-renderer">
            SHACL renderer
          </a>{" "}
          and{" "}
          <a href="https://github.com/ShapeThing/shapething/tree/main/packages/typed-sparql">
            Typed SPARQL
          </a>
          , two packages from{" "}
          <a href="https://shapething.com" target="_blank" rel="noreferrer">
            ShapeThing
          </a>
          .
        </p>
      </div>
    </Modal>
  );
}
