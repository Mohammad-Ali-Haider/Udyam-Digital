import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useApp, useJourney } from "./provider";
import { requestId, RequestError } from "./api";
import { useRef, useState, useCallback, useEffect } from "react";
import { storage } from "./storage";
export function useDraft(name: string) {
  const { base } = useApp();
  const key = `udyam.messageDraft.${base}.${name}`;
  const [value, setValue] = useState("");
  useEffect(() => {
    let active = true;
    void storage.get(key).then((v) => {
      if (active) setValue(v || "");
    });
    return () => {
      active = false;
    };
  }, [key]);
  const update = (v: string) => {
    setValue(v);
    void (v ? storage.set(key, v) : storage.remove(key));
  };
  return [value, update] as const;
}
export function useResource<T>(path: string, customer = true) {
  const { api, base } = useApp();
  const client = useQueryClient();
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const journey = useJourney(customer);
  const query = useQuery({
    queryKey: ["resource", base, path],
    queryFn: async () => {
      try {
        return await api.request<T>(path);
      } catch (error) {
        if (!customer && error instanceof RequestError && error.status === 401)
          client.setQueryData(["staff", base], null);
        throw error;
      }
    },
    staleTime: 0,
    enabled: focused && (!customer || !!journey.data),
    refetchInterval: focused ? 5000 : false,
    refetchIntervalInBackground: false,
  });
  return {
    ...query,
    error: query.error || (customer ? journey.error : null),
    isPending: query.isPending && !(customer && journey.error),
    refetch: async () => {
      if (customer) await journey.refetch();
      return query.refetch();
    },
  };
}
export function useAction(path: string, onSuccess?: () => void) {
  const { api } = useApp();
  const client = useQueryClient();
  const pending = useRef<{ body: string; id: string } | null>(null);
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => {
      const key = JSON.stringify(body);
      if (pending.current?.body !== key)
        pending.current = { body: key, id: requestId() };
      return api.request(path, "POST", {
        ...body,
        requestId: pending.current.id,
      });
    },
    onSuccess: async () => {
      pending.current = null;
      onSuccess?.();
      await client.invalidateQueries({ queryKey: ["resource"] });
      await client.invalidateQueries({ queryKey: ["journey"] });
    },
  });
}
export const stateLabel = (
  value: string,
  t: (en: string, hi: string) => string,
) => {
  const labels: Record<string, [string, string]> = {
    open: ["Open", "खुला"],
    in_progress: ["In progress", "काम जारी"],
    waiting_customer: ["Waiting for customer", "ग्राहक के जवाब की प्रतीक्षा"],
    resolved: ["Resolved", "समाधान हुआ"],
    confirmed: ["Confirmed", "पुष्टि हुई"],
    scheduled: ["Installation scheduled", "इंस्टॉलेशन तय"],
    installing: ["Installation in progress", "इंस्टॉलेशन जारी"],
    activated: ["Demo activation complete", "डेमो सक्रियण पूरा"],
    high: ["High", "उच्च"],
    medium: ["Medium", "मध्यम"],
    low: ["Low", "कम"],
    help_requested: ["Help requested", "मदद का अनुरोध"],
    quote_accepted: ["Quote accepted", "कोटेशन स्वीकार"],
    document_action: ["Document action required", "दस्तावेज़ में सुधार चाहिए"],
    inactive: ["Inactive for ten minutes", "दस मिनट से निष्क्रिय"],
  };
  return labels[value] ? t(...labels[value]) : value;
};
