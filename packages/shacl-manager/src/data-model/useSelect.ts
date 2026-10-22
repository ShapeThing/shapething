import { noRefetch } from "@/data-model/noRefetch";
import { select } from "@/data-model/select";
import { useDataModel } from "@/data-model/useDataModel";
import type { TypedQuery } from "@shapething/typed-sparql";
import { useSuspenseQuery } from "@tanstack/react-query";

export const useSelect = <TRow extends object>(query: TypedQuery<TRow>) => {
  const { store, dataModelIRI } = useDataModel();

  const { data } = useSuspenseQuery({
    queryKey: ["shacl-manager-select", dataModelIRI.value, query],
    ...noRefetch,
    // react-query treats a resolved `undefined` as an error ("Query data cannot be undefined"),
    // so "nothing to seed" is represented as `null` instead.
    queryFn: async () => {
      return select(query, store);
    },
  });

  return data;
};
