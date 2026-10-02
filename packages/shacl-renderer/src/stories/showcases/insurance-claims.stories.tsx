import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { ex } from "@/helpers/namespaces.ts";
import { testingEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Showcases/Insurance claims",
  component: ShaclRenderer,
  args: testingEnvironment,
};

// Depending on the sort of claim, extra fields from separate shapes attach to the one main shape -
// ex:AutoClaimShape/HomeClaimShape/HealthClaimShape each declare only a sh:targetWhere (3.1.3.6),
// no sh:and/sh:node/sh:or link to ex:InsuranceClaimShape at all. useTargetWhereFragments (see
// outputs/render/hooks/) checks the focusNode against every sh:targetWhere shape in the
// shapesGraph and folds whichever ones conform into nodeShapes, live - changing "Claim type" in
// the open form swaps the extra fields immediately, the same as sh:or/sh:xone's ChoiceElement
// does for a branch switch (compare "7.7.3.f sh-or.ttl"). The fixture opens on an Auto claim, so
// ex:AutoClaimShape is what's attached at first - try changing Claim type to see another attach.
export const insuranceClaim: Story = {
  name: "TargetWhere fragments",
  args: {
    ...argsByTestFile("insurance-claims.ttl", import.meta.url),
    nodeShapes: [ex("InsuranceClaimShape")],
  },
};
