import React from "react";
import { Redirect } from "expo-router";
import type { Journey } from "@udyam/shared";
import { useJourney } from "../lib/provider";
import { Loading, ErrorNotice, Shell } from "./ui";

export function JourneyGate({
  stage,
  children,
}: {
  stage: number;
  children: (journey: Journey) => React.ReactNode;
}) {
  const query = useJourney();
  if (query.isPending)
    return (
      <Shell>
        <Loading />
      </Shell>
    );
  if (!query.data)
    return (
      <Shell>
        <ErrorNotice error={query.error} retry={() => void query.refetch()} />
      </Shell>
    );
  const journey = query.data;
  if (journey.order && stage > 0)
    return (
      <Redirect
        href={
          journey.order.status === "activated"
            ? "/home"
            : `/orders/${journey.order.id}`
        }
      />
    );
  if (stage > 0 && !journey.profile) return <Redirect href="/business" />;
  if (stage >= 2 && !journey.advisorState?.ready && journey.advisorStep < 6)
    return <Redirect href="/advisor" />;
  if (stage >= 3 && !journey.quote) return <Redirect href="/bundle" />;
  if (stage >= 4 && !journey.quote?.acceptedAt)
    return <Redirect href="/checkout" />;
  return <>{children(journey)}</>;
}
