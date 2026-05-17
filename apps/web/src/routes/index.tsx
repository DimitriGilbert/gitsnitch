import { createFileRoute } from "@tanstack/react-router";

import { MarketingLanding } from "../components/marketing-landing";

export const Route = createFileRoute("/")({
  component: MarketingLanding,
});
