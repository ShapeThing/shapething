import factory from "@rdfjs/data-model";

export const context = {
  "@vocab": "http://ontology.shapething.com/shacl-renderer/props/",
  sh: "http://www.w3.org/ns/shacl#",
};

export const settingsSubject = factory.namedNode(
  "http://ontology.shapething.com/shacl-renderer/playground/settings"
);

export const examples = {
  Contact: {
    "Create Contact": {
      shapes: new URL("./shapes/contact.ttl", location.href),
      props: {
        mode: "edit",
      },
    },
    "Edit contact": {
      shapes: new URL("./shapes/contact.ttl", location.href),
      data: new URL("./data/john.ttl", location.href),
      props: {
        mode: "edit",
      },
    },
    "Contact with invalid data": {
      shapes: new URL("./shapes/contact.ttl", location.href),
      data: new URL("./data/john-invalid.ttl", location.href),
      props: {
        mode: "edit",
      },
    },
    "View contact": {
      shapes: new URL("./shapes/contact.ttl", location.href),
      data: new URL("./data/john.ttl", location.href),
      props: {
        mode: "view",
      },
    },
  },
  Academic: {
    "Edit academic person": {
      shapes: new URL("./shapes/academic.ttl", location.href),
      data: new URL("./data/academic-data.ttl", location.href),
      props: {
        mode: "edit",
        subject: "http://example.org/alice",
      },
    },
  },
  Recipe: {
    "Edit recipe": {
      shapes: new URL("./shapes/recipe.ttl", location.href),
      data: new URL("./data/recipe.ttl", location.href),
      props: {
        mode: "edit",
      },
    },
    "View recipe": {
      shapes: new URL("./shapes/recipe.ttl", location.href),
      data: new URL("./data/recipe.ttl", location.href),
      props: {
        mode: "view",
      },
    },
  },
};
