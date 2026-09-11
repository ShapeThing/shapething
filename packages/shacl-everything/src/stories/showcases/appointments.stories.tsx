import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { ex } from "@/helpers/namespaces.ts";
import { testingEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Showcases/Appointments",
  component: ShaclRenderer,
  args: testingEnvironment,
};

// sh:targetWhere can react to anything a SHACL shape can express - not just an equality check on
// a dedicated "kind" field like the insurance claim in insurance-claims.stories.tsx.
// ex:UpcomingAppointmentShape/PastAppointmentShape react to a plain
// sh:minExclusive/sh:maxInclusive range on ex:scheduledDate, against a fixed reference date
// standing in for "today" (see appointments.ttl's own comment for why that date is spelled out in
// sh:description rather than anywhere else). The fixture's appointment is scheduled after that
// date, so ex:UpcomingAppointmentShape attaches - edit "Scheduled date" to 2026-09-09 or earlier
// to watch it swap for ex:PastAppointmentShape's field, live, the same way changing "Claim type"
// does there.
export const appointmentDateTrigger: Story = {
  name: "TargetWhere reacting to a date",
  args: {
    ...argsByTestFile("appointments.ttl", import.meta.url),
    nodeShapes: [ex("AppointmentShape")],
  },
};
