import { defaultEnvironment } from "@/environment.ts";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { factory } from "@/helpers/factory.ts";
import InterfaceLanguageProvider from "@/outputs/render/contexts/InterfaceLanguageProvider.tsx";
import L10nProvider from "@/outputs/render/contexts/L10nProvider.tsx";
import { runPreprocessors } from "@/preprocess/index.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import AutoCompleteEditor from "@/widgets/implementations/shui/editors/AutoCompleteEditor/widget.tsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export default {
  title: "Tests/UI Components",
  component: <></>,
};

const rawEnvironment = argsByTestFile(
  "../../../widgets/implementations/shui/editors/AutoCompleteEditor/10.1.1 shui-auto-complete-editor.ttl",
  import.meta.url,
);

const environment = await runPreprocessors({
  ...defaultEnvironment,
  ...rawEnvironment,
});

const { shapesGraph, dataGraph, focusNode } = environment;

console.log(shapesGraph.getQuads());

const propertyShapes = [factory.namedNode("")];

const shape = new PropertyUIElement({
  shapesGraph: shapesGraph,
  dataGraph: dataGraph,
  focusNode: focusNode,
  propertyShapes: propertyShapes,
});
const term = factory.namedNode("http://example.com/test");
const setTerm = () => {};
const labelledBy = "";
const autoFocus = false;

export function Buttons() {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <InterfaceLanguageProvider interfaceLanguage="en">
        <L10nProvider interfaceLocales={{}}>
          <AutoCompleteEditor
            shape={shape}
            term={term}
            setTerm={setTerm}
            labelledBy={labelledBy}
            autoFocus={autoFocus}
          />
        </L10nProvider>
      </InterfaceLanguageProvider>
    </QueryClientProvider>
  );
}
